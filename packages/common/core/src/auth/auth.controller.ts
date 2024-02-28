import { Controller, Delete, Get, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { LoggerFactory } from "../logger";
import { accessTokenCookieOptions, Constants, Paths, refreshTokenCookieOptions } from "./auth.constants";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Controller( Paths.AUTH )
export class AuthController {

	private readonly logger = LoggerFactory.getLogger( AuthController );

	constructor( private readonly authService: AuthService ) {}

	@Get( Paths.AUTH_CALLBACK )
	async callback( @Req() req: Request, @Res() res: Response ) {
		this.logger.debug( ">> handleAuthCallback()" );
		const code = req.query[ "code" ] as string;
		const { accessToken, refreshToken } = await this.authService.handleAuthCallback( code );
		res.cookie( Constants.AUTH_COOKIE, accessToken, accessTokenCookieOptions );
		res.cookie( Constants.REFRESH_COOKIE, refreshToken, refreshTokenCookieOptions );
		res.redirect( "http://localhost:3000" );
		this.logger.debug( "<< handleAuthCallback()" );
	}

	@Get()
	@UseGuards( AuthGuard )
	async getAuthInfo( @Res() res: Response ) {
		this.logger.debug( ">> getAuthUser()" );
		const authUser = res.locals[ Constants.AUTH_USER ];
		res.send( authUser );
		this.logger.debug( "<< getAuthUser()" );
	}

	@Delete( Paths.LOGOUT )
	@UseGuards( AuthGuard )
	async logout( @Res() res: Response ) {
		this.logger.debug( ">> logout()" );
		res.clearCookie( Constants.AUTH_COOKIE, accessTokenCookieOptions );
		res.clearCookie( Constants.REFRESH_COOKIE, refreshTokenCookieOptions );
		res.status( 204 ).send();
		this.logger.debug( "<< logout()" );
	}
}