import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import type { Request, Response } from "express";
import { Constants } from "../constants";
import { QueryBus } from "@nestjs/cqrs";
import { AggregatedGameQuery } from "../queries";
import type { AggregatedGameData } from "@literature/data";

@Injectable()
export class RequireGameGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireGameGuard );

	constructor( private readonly queryBus: QueryBus ) {}

	async canActivate( context: ExecutionContext ) {
		this.logger.info( ">> canActivate()" );
		const req = context.switchToHttp().getRequest<Request>();
		const res = context.switchToHttp().getResponse<Response>();
		const gameId: string = req.params[ "gameId" ];
		this.logger.info( "GameId: %s", gameId );

		const game: AggregatedGameData = await this.queryBus.execute( new AggregatedGameQuery( gameId ) );
		res.locals[ Constants.ACTIVE_GAME ] = game;
		return !!game;
	}
}