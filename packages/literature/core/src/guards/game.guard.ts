import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import type { Request, Response } from "express";
import { Constants } from "../constants";
import { QueryBus } from "@nestjs/cqrs";
import { CardMappingsQuery, GameDataQuery, PlayerDataQuery } from "../queries";
import type { GameData } from "@literature/types";
import { Reflector } from "@nestjs/core";
import type { UserAuthInfo } from "@auth/types";
import type { RequiresGameData } from "../decorators";

@Injectable()
export class GameGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( GameGuard );

	constructor(
		private readonly queryBus: QueryBus,
		private readonly reflector: Reflector
	) {}

	async canActivate( context: ExecutionContext ) {
		this.logger.info( ">> canActivate()" );
		const req = context.switchToHttp().getRequest<Request>();
		const res = context.switchToHttp().getResponse<Response>();
		const gameId: string = req.params[ "gameId" ];
		const authInfo: UserAuthInfo = res.locals[ Constants.AUTH_INFO ];
		this.logger.info( "GameId: %s", gameId );

		const game: GameData = await this.queryBus.execute( new GameDataQuery( gameId ) );
		res.locals[ Constants.GAME_DATA ] = game;

		if ( !game.players[ authInfo.id ] ) {
			this.logger.error( "Logged In User not part of this game! UserId: %s", authInfo.id );
			throw new ForbiddenException();
		}

		res.locals[ Constants.PLAYER_DATA ] = await this.queryBus.execute( new PlayerDataQuery( game, authInfo.id ) );

		const { status, turn, cardMappings }: RequiresGameData = this.reflector.get(
			Constants.REQUIRES_KEY,
			context.getHandler()
		) ?? {};

		if ( !!status && game.status !== status ) {
			this.logger.debug( "Game Present but not in correct status!" );
			throw new BadRequestException();
		}

		if ( !!turn && game.currentTurn !== authInfo.id ) {
			this.logger.error( "It is not logged in User's turn! UserId: %s", authInfo.id );
			throw new ForbiddenException();
		}

		if ( !!cardMappings ) {
			res.locals[ Constants.CARD_MAPPINGS ] = await this.queryBus.execute( new CardMappingsQuery( game ) );
		}

		return !!game;
	}
}