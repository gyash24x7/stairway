import { BadRequestException, CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { LoggerFactory } from "@s2h/utils";
import type { Response } from "express";
import { CallbreakDeal, CallbreakGame, CallbreakRound, CallbreakRoundStatus } from "@callbreak/data";

@Injectable()
export class RequireRoundGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireRoundGuard );

	async canActivate( context: ExecutionContext ) {
		const res = context.switchToHttp().getResponse<Response>();
		const currentGame: CallbreakGame = res.locals[ "currentGame" ];
		const currentDeal: CallbreakDeal = res.locals[ "currentDeal" ];

		if ( !currentDeal ) {
			this.logger.warn( "No active Deal!" );
			throw new NotFoundException();
		}

		const activeRounds = currentDeal.roundList.filter( round => {
			return round.status === CallbreakRoundStatus.CREATED || round.status === CallbreakRoundStatus.IN_PROGRESS;
		} );

		if ( activeRounds.length !== 1 ) {
			this.logger.error( "There are more than 1 active round for the game! Game: %s", currentGame.id );
			throw new BadRequestException();
		}

		const activeRound = activeRounds[ 0 ];
		res.locals[ "currentRound" ] = CallbreakRound.from( { ...activeRound, id: activeRound.id } );
		return !!activeRound;
	}
}