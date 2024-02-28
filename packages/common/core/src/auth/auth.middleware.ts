import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthMiddleware implements NestMiddleware {

	constructor( private readonly authService: AuthService ) {}

	async use( req: Request, res: Response, next: NextFunction ) {
		await this.authService.authenticateRequest( req, res );
		return next();
	}
}