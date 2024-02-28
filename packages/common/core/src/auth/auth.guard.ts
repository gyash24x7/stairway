import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { LoggerFactory } from "../logger";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthGuard implements CanActivate {

	private readonly logger = LoggerFactory.getLogger( AuthGuard );

	constructor( private readonly authService: AuthService ) {}

	async canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> useAuthMiddleware()" );

		const req = context.switchToHttp().getRequest<Request>();
		const res = context.switchToHttp().getResponse<Response>();

		await this.authService.authenticateRequest( req, res );

		return true;
	}
}