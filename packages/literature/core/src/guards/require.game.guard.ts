import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import type { Request, Response } from "express";
import { prisma } from "../utils";
import { Constants } from "../constants";

@Injectable()
export class RequireGameGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireGameGuard );

	async canActivate( context: ExecutionContext ) {
		this.logger.info( ">> canActivate()" );
		const req = context.switchToHttp().getRequest<Request>();
		const res = context.switchToHttp().getResponse<Response>();
		const gameId: string = req.params[ "gameId" ];
		this.logger.info( "GameId: %s", gameId );

		const game = await prisma.game.getAggregatedData( gameId );
		res.locals[ Constants.ACTIVE_GAME ] = game;
		return !!game;
	}
}