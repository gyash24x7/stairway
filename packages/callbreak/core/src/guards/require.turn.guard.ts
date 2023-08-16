import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LoggerFactory } from "@s2h/utils";
import type { Response } from "express";
import type { UserAuthInfo } from "@auth/data";
import type { CallbreakGame, CallbreakRound } from "@callbreak/data";

@Injectable()
export class RequireTurnGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireTurnGuard );

	canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> requireTurn()" );
		const res = context.switchToHttp().getResponse<Response>();
		const currentGame: CallbreakGame = res.locals[ "currentGame" ];
		const currentRound: CallbreakRound = res.locals[ "currentRound" ];
		const authInfo: UserAuthInfo = res.locals[ "authInfo" ];

		if ( !currentRound ) {
			this.logger.error( "Game Not Present!" );
			throw new NotFoundException();
		}

		if ( currentRound.currentTurn !== authInfo.id ) {
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "It is not logged in User's turn! UserId: %s", authInfo.id );
			throw new ForbiddenException();
		}

		return true;
	}
}