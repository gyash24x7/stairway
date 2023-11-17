import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Response } from "express";
import { LoggerFactory } from "../logger";
import { PrismaService } from "../prisma";
import { Constants } from "./auth.constants";

@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( AuthGuard );

	constructor( private readonly prisma: PrismaService ) {}

	async canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> canActivate()" );

		const res = context.switchToHttp().getResponse<Response>();
		const userId: string = res.locals[ Constants.AUTH_USER_ID ];

		if ( !userId ) {
			this.logger.debug( "<< canActivate()" );
			return false;
		}

		const user = await this.prisma.user.findUnique( { where: { id: userId } } );

		res.locals[ Constants.AUTH_USER ] = user;
		this.logger.debug( "<< canActivate()" );
		return !!user;
	}

}