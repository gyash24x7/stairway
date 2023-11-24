import { HttpException, LoggerFactory, Middleware } from "@common/core";
import type { GameStatus, User } from "@literature/types";
import type { NextFunction, Request, Response } from "express";
import { Constants } from "./literature.constants.js";
import type { LiteratureService } from "./literature.service.js";
import { literatureService } from "./literature.service.js";

export type RequiredGameData = {
	status?: GameStatus;
	turn?: boolean;
}

export class LiteratureMiddleware implements Middleware {
	private readonly logger = LoggerFactory.getLogger( LiteratureMiddleware );

	constructor( private readonly literatureService: LiteratureService ) {}

	async use( req: Request, res: Response, next: NextFunction ) {
		this.logger.info( ">> canActivate()" );

		const gameId: string = req.params[ "gameId" ];
		const authUser: User = res.locals[ Constants.AUTH_USER ];
		this.logger.info( "GameId: %s", gameId );

		const requiredGameData: RequiredGameData | undefined = res.locals[ Constants.REQUIRED_GAME_DATA ];

		const game = await this.literatureService.getGameData( gameId );

		if ( !game ) {
			this.logger.error( "Game Not Found! UserId: %s", authUser.id );
			throw new HttpException( 404 );
		}

		res.locals[ Constants.GAME_DATA ] = game;

		if ( !game.players[ authUser.id ] ) {
			this.logger.error( "Logged In User not part of this game! UserId: %s", authUser.id );
			throw new HttpException( 403 );
		}

		res.locals[ Constants.PLAYER_DATA ] = await this.literatureService.getPlayerSpecificData( game, authUser.id );

		if ( requiredGameData ) {

			const { status, turn } = requiredGameData;

			if ( status && game.status !== status ) {
				this.logger.error( "Game Status is not %s! GameId: %s", status, gameId );
				throw new HttpException( 400 );
			}

			if ( turn && game.currentTurn !== authUser.id ) {
				this.logger.error( "It's not your turn! GameId: %s", gameId );
				throw new HttpException( 400 );
			}

			if ( turn ) {
				res.locals[ Constants.CARDS_DATA ] = await this.literatureService.getCardsData( gameId );
			}
		}

		next();
	}
}

export const literatureMiddleware = new LiteratureMiddleware( literatureService );