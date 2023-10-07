import { BadRequestException, CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import type { Response } from "express";
import { Constants } from "../constants";
import type { AggregatedGameData, GameStatus } from "@literature/data";
import { Reflector } from "@nestjs/core";

@Injectable()
export class RequireGameStatusGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireGameStatusGuard );

	constructor( private readonly reflector: Reflector ) {}

	async canActivate( context: ExecutionContext ) {
		const res = context.switchToHttp().getResponse<Response>();
		const requiredStatus = this.reflector.get<GameStatus>( Constants.STATUS_KEY, context.getHandler() );
		const currentGame: AggregatedGameData = res.locals[ Constants.ACTIVE_GAME ];

		if ( !currentGame ) {
			this.logger.error( "Game Not Present!" );
			throw new NotFoundException();
		}

		if ( currentGame.status !== requiredStatus ) {
			this.logger.debug( "Game Present but not in correct status!" );
			throw new BadRequestException();
		}

		return true;
	}
}