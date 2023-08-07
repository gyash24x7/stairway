import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnauthorizedException
} from "@nestjs/common";
import { LoggerFactory } from "@s2h/utils";
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
		const authInfo: UserAuthInfo | null = res.locals[ "currentGame" ];

		if ( !authInfo ) {
			this.logger.error( "User Not Logged In!" );
			throw new UnauthorizedException();
		}

		if ( !currentGame ) {
			this.logger.error( "Game Not Present!" );
			throw new NotFoundException();
		}

		if ( currentGame.currentTurn !== authInfo.id ) {
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "It is not logged in User's turn! UserId: %s", authInfo.id );
			throw new ForbiddenException();
		}

		return true;
	}


}