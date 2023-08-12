import {
	BadRequestException,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException
} from "@nestjs/common";
import { LoggerFactory } from "@s2h/utils";
import type { UserAuthInfo } from "@auth/data";
import type { Response } from "express";
import type { LiteratureGame } from "@literature/data";

@Injectable()
export class RequirePlayerGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequirePlayerGuard );

	canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> requirePlayer()" );
		const res = context.switchToHttp().getResponse<Response>();
		const currentGame: LiteratureGame = res.locals[ "currentGame" ];
		const authInfo: UserAuthInfo | null = res.locals[ "currentGame" ];

		if ( !authInfo ) {
			this.logger.error( "User Not Logged In!" );
			throw new UnauthorizedException();
		}

		if ( !currentGame ) {
			this.logger.error( "Game Not Present!" );
			throw new BadRequestException();
		}

		if ( !currentGame.players[ authInfo.id ] ) {
			this.logger.trace( "Game: %o", currentGame );
			this.logger.error( "Logged In User not part of this game! UserId: %s", authInfo.id );
			throw new ForbiddenException();
		}

		return true;
	}


}