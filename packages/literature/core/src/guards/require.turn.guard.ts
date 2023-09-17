import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import type { Response } from "express";
import type { UserAuthInfo } from "@auth/data";
import type { LiteratureGame } from "@literature/data";

@Injectable()
export class RequireTurnGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireTurnGuard );

	canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> requireTurn()" );
		const res = context.switchToHttp().getResponse<Response>();
		const currentGame: LiteratureGame = res.locals[ "currentGame" ];
		const authInfo: UserAuthInfo = res.locals[ "currentGame" ];

		if ( currentGame.currentTurn !== authInfo.id ) {
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "It is not logged in User's turn! UserId: %s", authInfo.id );
			throw new ForbiddenException();
		}

		return true;
	}


}