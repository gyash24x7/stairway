import { Controller, Delete, Get, HttpCode, HttpStatus, Query, Res } from "@nestjs/common";
import type { User } from "@prisma/client";
import { LoggerFactory } from "@s2h/core";
import type { Response } from "express";
import { accessTokenCookieOptions, Constants, Paths, refreshTokenCookieOptions } from "./auth.constants";
import { AuthUser, RequiresAuth } from "./auth.decorators";
import { AuthService } from "./auth.service";

@Controller( Paths.BASE )
export class AuthController {

	private readonly logger = LoggerFactory.getLogger( AuthController );

	constructor( private readonly authService: AuthService ) {}

	@Get( Paths.AUTH_CALLBACK )
	async handleAuthCallback( @Query( "code" ) code: string, @Res() res: Response ) {
		this.logger.debug( ">> handleAuthCallback()" );
		const { accessToken, refreshToken } = await this.authService.handleAuthCallback( code );
		res.cookie( Constants.AUTH_COOKIE, accessToken, accessTokenCookieOptions );
		res.cookie( Constants.REFRESH_COOKIE, refreshToken, refreshTokenCookieOptions );
		res.redirect( "http://localhost:3000" );
		this.logger.debug( "<< handleAuthCallback()" );
	}

	@Get()
	@RequiresAuth()
	async getAuthUser( @AuthUser() authUser: User ) {
		this.logger.debug( ">> getAuthUser()" );
		return authUser;
	}

	@Delete( Paths.LOGOUT )
	@RequiresAuth()
	@HttpCode( HttpStatus.NO_CONTENT )
	logout( @Res() res: Response ) {
		this.logger.debug( ">> logout()" );
		res.clearCookie( Constants.AUTH_COOKIE, accessTokenCookieOptions );
		res.clearCookie( Constants.REFRESH_COOKIE, refreshTokenCookieOptions );
		res.status( HttpStatus.NO_CONTENT ).send();
		this.logger.debug( "<< logout()" );
	}
}