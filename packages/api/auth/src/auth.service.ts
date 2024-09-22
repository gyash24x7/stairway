import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { LoggerFactory, PostgresClientFactory } from "@shared/api";
import { generateCodeVerifier, generateState, Google, OAuth2RequestError } from "arctic";
import { eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Request, Response } from "express";
import { Lucia } from "lucia";
import * as schema from "./auth.schema.ts";

type GoogleUser = {
	id: string;
	email: string;
	verified_email: boolean;
	name: string;
	given_name: string;
	family_name: string;
	picture: string;
	locale: string;
}

export type UserAuthInfo = {
	id: string;
	name: string;
	avatar: string;
}

@Injectable()
export class AuthService {

	private readonly logger = LoggerFactory.getLogger( AuthService );

	private readonly db: PostgresJsDatabase<typeof schema>;
	private readonly google: Google;
	private readonly lucia: Lucia<Record<never, never>, UserAuthInfo>;

	constructor( private readonly postgresClientFactory: PostgresClientFactory ) {
		const clientId = Bun.env[ "GOOGLE_CLIENT_ID" ]!;
		const clientSecret = Bun.env[ "GOOGLE_CLIENT_SECRET" ]!;
		const redirectUri = Bun.env[ "GOOGLE_REDIRECT_URI" ]!;

		this.google = new Google( clientId, clientSecret, redirectUri );

		const postgresClient = this.postgresClientFactory.get();
		this.db = drizzle( postgresClient, { schema } );
		const adapter = new DrizzlePostgreSQLAdapter( this.db, schema.sessions, schema.users );

		this.lucia = new Lucia( adapter, {
			sessionCookie: {
				name: "auth_session",
				expires: false,
				attributes: {
					secure: Bun.env[ "NODE_ENV" ] === "production"
				}
			},
			getUserAttributes( attributes ) {
				return { ...attributes };
			}
		} );
	}

	async getAuthorizationUrl() {
		this.logger.debug( ">> getAuthorizationUrl()" );

		const state = generateState();
		const codeVerifier = generateCodeVerifier();
		const scopes = [ "openid", "profile", "email" ];
		const url = await this.google.createAuthorizationURL( state, codeVerifier, { scopes } );

		this.logger.debug( "<< getAuthorizationUrl()" );
		return { url, state, codeVerifier };
	}

	async validateRequest( req: Request, res: Response ) {
		this.logger.debug( ">> validateRequest()" );

		const sessionId = req.cookies[ "auth_session" ];
		if ( !sessionId ) {
			throw new UnauthorizedException();
		}

		const { user, session } = await this.lucia.validateSession( sessionId );

		if ( !session ) {
			this.logger.debug( "<< validateRequest()" );
			throw new UnauthorizedException();
		}

		if ( session && session.fresh ) {
			const cookie = this.lucia.createSessionCookie( session.id );
			res.cookie( cookie.name, cookie.value, cookie.attributes );
		}

		this.logger.debug( "<< validateRequest()" );
		return { user, session };
	}

	async handleAuthCallback( code: string, codeVerifier: string ) {
		this.logger.debug( ">> handleAuthCallback()" );

		try {
			const { name, email } = await this.getGoogleUser( code, codeVerifier );
			let user = await this.db.query.users.findFirst( { where: eq( schema.users.email, email ) } );

			if ( !user ) {
				[ user ] = await this.db.insert( schema.users ).values( { name, email } ).returning();
			}

			const session = await this.lucia.createSession( user.id, {} );
			const sessionCookie = this.lucia.createSessionCookie( session.id );

			this.logger.debug( "<< handleAuthCallback()" );
			return { status: 302 as const, sessionCookie };

		} catch ( e ) {
			this.logger.debug( "<< handleAuthCallback()" );
			return { status: e instanceof OAuth2RequestError ? 400 as const : 500 as const };
		}
	}

	async invalidateSession( req: Request ) {
		this.logger.debug( ">> invalidateSession()" );

		const sessionId = req.cookies[ this.lucia.sessionCookieName ];
		if ( !sessionId ) {
			throw new UnauthorizedException();
		}

		await this.lucia.invalidateSession( sessionId );
		const blankCookie = this.lucia.createBlankSessionCookie();

		this.logger.debug( "<< invalidateSession()" );
		return blankCookie;
	}

	private async getGoogleUser( code: string, codeVerifier: string ) {
		this.logger.debug( ">> getGoogleUser()" );

		const tokens = await this.google.validateAuthorizationCode( code, codeVerifier );

		const url = new URL( "https://www.googleapis.com/oauth2/v1/userinfo" );
		url.searchParams.append( "alt", "json" );
		url.searchParams.append( "access_token", tokens.accessToken );

		const headers = { Authorization: `Bearer ${ tokens.idToken }` };
		const user = await fetch( url, { headers } ).then( res => res.json() );

		this.logger.debug( "<< getGoogleUser()" );
		return user as GoogleUser;
	}
}