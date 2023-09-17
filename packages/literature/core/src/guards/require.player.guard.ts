import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import type { UserAuthInfo } from "@auth/data";
import type { Response } from "express";
import type { LiteratureGame } from "@literature/data";
import { Constants } from "../constants";

@Injectable()
export class RequirePlayerGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequirePlayerGuard );

	canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> requirePlayer()" );
		const res = context.switchToHttp().getResponse<Response>();
		const currentGame: LiteratureGame = res.locals[ Constants.ACTIVE_GAME ];
		const authInfo: UserAuthInfo = res.locals[ Constants.AUTH_INFO ];

		if ( !currentGame.players[ authInfo.id ] ) {
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Logged In User not part of this game! UserId: %s", authInfo.id );
			throw new ForbiddenException();
		}

		return true;
	}
}