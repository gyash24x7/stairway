import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/utils";
import type { Request, Response } from "express";
import { JwtService } from "../services";

@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( AuthGuard );

	constructor( private readonly jwtService: JwtService ) {}

	async canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> canActivate()" );
		const req = context.switchToHttp().getRequest<Request>();
		const res = context.switchToHttp().getResponse<Response>();
		const token: string = req.cookies[ "auth-cookie" ];
		const authInfo = await this.jwtService.verify( token );
		res.locals[ "authInfo" ] = authInfo;
		return !!authInfo;
	}

}