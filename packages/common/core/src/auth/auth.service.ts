import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import Cookies from "cookies";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import process from "process";
import superagent from "superagent";
import { URL } from "url";
import { LoggerFactory } from "../logger";
import { PostgresClientFactory } from "../postgres";
import { accessTokenCookieOptions, Constants, TokenType } from "./auth.constants";
import { type AuthDrizzleClient, createAuthDrizzleClient, users } from "./auth.utils";
import { JwtService } from "./jwt.service";

type GoogleTokenResult = {
	access_token: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
	id_token: string;
}

type GoogleUserResult = {
	id: string;
	email: string;
	verified_email: boolean;
	name: string;
	given_name: string;
	family_name: string;
	picture: string;
	locale: string;
}

@Injectable()
export class AuthService {

	private readonly logger = LoggerFactory.getLogger( AuthService );
	private readonly db: AuthDrizzleClient;

	constructor(
		readonly postgresClientFactory: PostgresClientFactory,
		private readonly jwtService: JwtService
	) {
		this.db = createAuthDrizzleClient( postgresClientFactory.get() );
	}

	async authenticateRequest( req: Request, res: Response ) {
		const cookies = Cookies( req, res );

		const accessToken = cookies.get( Constants.AUTH_COOKIE );
		const refreshToken = cookies.get( Constants.REFRESH_COOKIE );

		if ( !accessToken ) {
			this.logger.error( "No Access Token!" );
			throw new UnauthorizedException();
		}

		const response = this.jwtService.verify( accessToken );

		if ( !!response.subject ) {
			res.locals[ Constants.AUTH_USER ] = await this.getAuthUser( response.subject );
			return;
		}

		if ( !response.expired || !refreshToken ) {
			this.logger.error( "Cannot ReIssue Access Token!" );
			throw new UnauthorizedException();
		}

		const newAccessToken = await this.reIssueAccessToken( refreshToken );

		if ( !newAccessToken ) {
			this.logger.error( "Unknown User!" );
			throw new UnauthorizedException();
		}

		res.cookie( Constants.AUTH_COOKIE, newAccessToken, accessTokenCookieOptions );
		const { subject } = this.jwtService.verify( newAccessToken );

		res.locals[ Constants.AUTH_USER ] = await this.getAuthUser( subject! );
	}

	async getAuthUser( userId: string ) {
		this.logger.debug( ">> getAuthUser()" );
		const [ user ] = await this.db.select().from( users ).where( eq( users.id, userId ) );
		this.logger.debug( "<< getAuthUser()" );
		return user;
	}

	async handleAuthCallback( code: string ) {
		this.logger.debug( ">> handleAuthCallback()" );

		const { access_token, id_token } = await this.getGoogleToken( code );
		const { verified_email, name, email } = await this.getGoogleUser( access_token, id_token );

		if ( !verified_email ) {
			this.logger.warn( "Email Not Verified!" );
			throw new ForbiddenException();
		}

		let [ user ] = await this.db.select().from( users ).where( eq( users.email, email ) );

		if ( !user ) {
			this.logger.debug( "New User!" );
			[ user ] = await this.db.insert( users ).values( [ { name, email } ] ).returning();
		}

		const accessToken = this.jwtService.sign( user.id, TokenType.ACCESS_TOKEN );
		const refreshToken = this.jwtService.sign( user.id, TokenType.REFRESH_TOKEN );

		this.logger.debug( "<< handleAuthCallback()" );
		return { accessToken, refreshToken };
	}

	async reIssueAccessToken( refreshToken: string ) {
		this.logger.debug( ">> reIssueAccessToken()" );
		const { subject } = this.jwtService.verify( refreshToken );

		if ( !subject ) {
			return;
		}

		let [ user ] = await this.db.select().from( users ).where( eq( users.id, subject ) );

		if ( !user ) {
			return;
		}

		return this.jwtService.sign( subject, TokenType.ACCESS_TOKEN );
	}

	async getGoogleToken( code: string ) {
		this.logger.debug( ">> getGoogleToken()" );

		const url = new URL( Constants.GOOGLE_TOKEN_URL );
		url.searchParams.append( "code", code );
		url.searchParams.append( "client_id", process.env[ "GOOGLE_CLIENT_ID" ]! );
		url.searchParams.append( "client_secret", process.env[ "GOOGLE_CLIENT_SECRET" ]! );
		url.searchParams.append( "redirect_uri", process.env[ "GOOGLE_REDIRECT_URI" ]! );
		url.searchParams.append( "grant_type", "authorization_code" );

		const response: GoogleTokenResult = await superagent
			.post( url.toString() )
			.set( "Content-Type", "application/x-www-form-urlencoded" )
			.then( res => res.body );

		this.logger.debug( "<< getGoogleToken()" );
		return response;
	}

	async getGoogleUser( access_token: string, id_token: string ) {
		this.logger.debug( ">> getGoogleUser()" );

		const url = new URL( Constants.GOOGLE_GET_USER_URL );
		url.searchParams.append( "alt", "json" );
		url.searchParams.append( "access_token", access_token );

		const response: GoogleUserResult = await superagent
			.get( url.toString() )
			.set( "Authorization", `Bearer ${ id_token }` )
			.then( res => res.body );

		this.logger.debug( "<< getGoogleUser()" );
		return response;
	}
}
