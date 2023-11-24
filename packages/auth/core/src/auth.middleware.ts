import { LoggerFactory, Middleware } from "@common/core";
import type { NextFunction, Request, Response } from "express";
import { accessTokenCookieOptions, Constants, Messages } from "./auth.constants";
import { authService, AuthService } from "./auth.service";
import { jwtService, JwtService } from "./jwt.service";

export class AuthMiddleware implements Middleware {

	private readonly logger = LoggerFactory.getLogger( AuthMiddleware );

	constructor(
		private readonly authService: AuthService,
		private readonly jwtService: JwtService
	) {}

	async use( req: Request, res: Response, next: NextFunction ) {
		this.logger.debug( ">> useAuthMiddleware()" );
		const accessToken: string = req.cookies[ Constants.AUTH_COOKIE ];
		const refreshToken: string = req.cookies[ Constants.REFRESH_COOKIE ];

		if ( !accessToken ) {
			this.logger.error( "No Access Token!" );
			return res.status( 401 ).send( Messages.UNAUTHORIZED );
		}

		const response = this.jwtService.verify( accessToken );

		if ( !!response.subject ) {
			res.locals[ Constants.AUTH_USER ] = await this.authService.getAuthUser( response.subject );
			return next();
		}

		if ( !response.expired || !refreshToken ) {
			this.logger.error( "Cannot ReIssue Access Token!" );
			return res.status( 401 ).send( Messages.UNAUTHORIZED );
		}

		const newAccessToken = await this.authService.reIssueAccessToken( refreshToken );

		if ( !newAccessToken ) {
			this.logger.error( "Unknown User!" );
			return res.status( 403 ).send( Messages.UNAUTHORIZED );
		}

		res.cookie( Constants.AUTH_COOKIE, newAccessToken, accessTokenCookieOptions );
		const { subject } = this.jwtService.verify( newAccessToken );
		res.locals[ Constants.AUTH_USER ] = await this.authService.getAuthUser( subject! );

		return next();
	}
}

export const authMiddleware = new AuthMiddleware( authService, jwtService );