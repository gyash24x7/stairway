import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { LoggerFactory } from "@s2h/core";
import type { Request, Response } from "express";
import { Constants } from "../constants";

@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( AuthGuard );

	constructor( private readonly jwtService: JwtService ) {}

	async canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> canActivate()" );
		const req = context.switchToHttp().getRequest<Request>();
		const res = context.switchToHttp().getResponse<Response>();
		const token: string = req.cookies[ Constants.AUTH_COOKIE ];

		if ( !token ) {
			this.logger.debug( "<< canActivate()" );
			return false;
		}

		const authInfo = await this.jwtService.verify( token );

		res.locals[ Constants.AUTH_INFO ] = authInfo;
		this.logger.debug( "<< canActivate()" );
		return !!authInfo;
	}

}