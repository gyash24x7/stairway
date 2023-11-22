import type { GameStatus, User } from "@literature/types";
import { HttpException, LoggerFactory, Middleware } from "@s2h/core";
import type { NextFunction, Request, Response } from "express";
import { Constants } from "./literature.constants";
import type { LiteratureService } from "./literature.service";
import { literatureService } from "./literature.service";

export type RequiredGameData = {
	status?: GameStatus;
	turn?: boolean;
	cards?: boolean;
}

export class LiteratureMiddleware implements Middleware {
	private readonly logger = LoggerFactory.getLogger( LiteratureMiddleware );

	constructor( private readonly literatureService: LiteratureService ) {}


	async use( req: Request, res: Response, next: NextFunction ) {
		this.logger.info( ">> canActivate()" );

		const gameId: string = req.params[ "gameId" ];
		const authUser: User = res.locals[ Constants.AUTH_USER ];
		this.logger.info( "GameId: %s", gameId );

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

		next();
	}
}

export const literatureMiddleware = new LiteratureMiddleware( literatureService );