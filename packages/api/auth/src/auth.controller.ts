import { BadRequestException, Controller, Delete, Get, Query, Redirect, Req, Res } from "@nestjs/common";
import { LoggerFactory } from "@shared/api";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.ts";

const FRONTEND_URL = Bun.env[ "FRONTEND_URL" ] ?? "http://localhost:3000";

const cookieOptions = {
	domain: Bun.env[ "NODE_ENV" ] === "production" ? "stairway.yashgupta.me" : "localhost",
	path: "/",
	secure: Bun.env[ "NODE_ENV" ] === "production",
	httpOnly: true,
	maxAge: 60 * 1000, // 1 min
	sameSite: "lax" as const,
	append: true
};

@Controller( "auth" )
export class AuthController {

	private readonly logger = LoggerFactory.getLogger( AuthController );

	constructor( private readonly authService: AuthService ) {}

	@Get( "login" )
	@Redirect()
	async login( @Res( { passthrough: true } ) res: Response ) {
		this.logger.debug( ">> login()" );

		const { url, state, codeVerifier } = await this.authService.getAuthorizationUrl();
		res.cookie( "google_oauth_state", state, cookieOptions );
		res.cookie( "google_code_verifier", codeVerifier, cookieOptions );

		this.logger.debug( "<< login()" );
		return { url };
	}

	@Get( "callback" )
	@Redirect()
	async authCallback(
		@Query( "code" ) code: string,
		@Query( "state" ) state: string,
		@Req() req: Request,
		@Res( { passthrough: true } ) res: Response
	) {
		this.logger.debug( ">> authCallback()" );

		const storedState = req.cookies[ "google_oauth_state" ];
		const codeVerifier = req.cookies[ "google_code_verifier" ];

		if ( !code || !state || !storedState || !codeVerifier || state !== storedState ) {
			this.logger.error( "StoredState: %s", storedState );
			this.logger.error( "CodeVerifier: %s", codeVerifier );
			this.logger.debug( "<< authCallback()" );
			throw new BadRequestException();
		}

		const { status, sessionCookie } = await this.authService.handleAuthCallback( code, codeVerifier );
		if ( sessionCookie ) {
			res.cookie( sessionCookie.name, sessionCookie.value, sessionCookie.attributes );
		}

		this.logger.debug( "<< authCallback()" );
		return { url: Bun.env.NODE_ENV === "production" ? "/" : FRONTEND_URL, status };
	}

	@Get( "user" )
	async user( @Req() req: Request, @Res( { passthrough: true } ) res: Response ) {
		this.logger.debug( ">> user()" );
		const { user } = await this.authService.validateRequest( req, res );
		this.logger.debug( "<< user()" );
		return user;
	}

	@Delete( "logout" )
	async logout( @Req() req: Request, @Res( { passthrough: true } ) res: Response ) {
		this.logger.debug( ">> logout()" );

		const sessionCookie = await this.authService.invalidateSession( req );
		res.cookie( sessionCookie.name, sessionCookie.value, sessionCookie.attributes );

		this.logger.debug( "<< logout()" );
	}
}