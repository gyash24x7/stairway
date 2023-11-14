import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import type { NextFunction, Request, Response } from "express";
import { accessTokenCookieOptions, Constants } from "../constants";
import { AuthService, JwtService } from "../services";

@Injectable()
export class AuthMiddleware implements NestMiddleware {

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
			return next();
		}

		const { subject, expired } = this.jwtService.verify( accessToken );

		if ( subject ) {
			res.locals[ Constants.AUTH_INFO_ID ] = subject;
			return next();
		}

		if ( expired && !!refreshToken ) {
			const newAccessToken = await this.authService.reIssueAccessToken( refreshToken );

			if ( !!newAccessToken ) {
				res.cookie( "accessToken", newAccessToken, accessTokenCookieOptions );
				const { subject } = this.jwtService.verify( newAccessToken );
				res.locals[ "userId" ] = subject;
			}

			return next();
		}

		return next();
	}
}