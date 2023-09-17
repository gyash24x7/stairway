import { BadRequestException, CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { CardHand } from "@s2h/cards";
import { LoggerFactory } from "@s2h/core";
import type { Response } from "express";
import { LiteratureService } from "../services";
import type { LiteratureGame } from "@literature/data";
import { Constants } from "../constants";

@Injectable()
export class RequireHandsGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireHandsGuard );

	constructor( private readonly literatureService: LiteratureService ) {}

	async canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> requireHands()" );
		const res = context.switchToHttp().getResponse<Response>();
		const currentGame: LiteratureGame = res.locals[ Constants.ACTIVE_GAME ];
		const hands = await this.literatureService.findHandsForGame( currentGame.id );
		const currentGameHands: Record<string, CardHand> = {};

		let handCount = 0;
		for ( const hand of hands ) {
			currentGameHands[ hand.playerId ] = CardHand.from( hand.hand );
			handCount++;
		}

		if ( handCount !== 6 ) {
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Hands Not Present! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		res.locals[ Constants.ACTIVE_GAME_HANDS ] = currentGameHands;
		return true;
	}


}