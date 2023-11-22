import { LoggerFactory } from "@s2h/core";
import type { Request, Response } from "express";
import { accessTokenCookieOptions, Constants, refreshTokenCookieOptions } from "./auth.constants";
import { authService, AuthService } from "./auth.service";

export class AuthController {

	private readonly logger = LoggerFactory.getLogger( AuthController );

	constructor( private readonly authService: AuthService ) {}

	async handleAuthCallback( req: Request, res: Response ) {
		this.logger.debug( ">> handleAuthCallback()" );
		const code = req.query[ "code" ] as string;
		const { accessToken, refreshToken } = await this.authService.handleAuthCallback( code );
		res.cookie( Constants.AUTH_COOKIE, accessToken, accessTokenCookieOptions );
		res.cookie( Constants.REFRESH_COOKIE, refreshToken, refreshTokenCookieOptions );
		res.redirect( "http://localhost:3000" );
		this.logger.debug( "<< handleAuthCallback()" );
	}

	async getAuthUser( _req: Request, res: Response ) {
		this.logger.debug( ">> getAuthUser()" );
		const authUser = res.locals[ Constants.AUTH_USER ];
		res.send( authUser );
		this.logger.debug( "<< getAuthUser()" );
	}

	logout( _req: Request, res: Response ) {
		this.logger.debug( ">> logout()" );
		res.clearCookie( Constants.AUTH_COOKIE, accessTokenCookieOptions );
		res.clearCookie( Constants.REFRESH_COOKIE, refreshTokenCookieOptions );
		res.status( 204 ).send();
		this.logger.debug( "<< logout()" );
	}
}

export const authController = new AuthController( authService );