import { BadRequestException, CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { LoggerFactory } from "@s2h/utils";
import type { Response } from "express";
import { type LiteratureGame, LiteratureGameStatus } from "@literature/data";

@Injectable()
export class RequireActiveGameGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireActiveGameGuard );

	async canActivate( context: ExecutionContext ) {
		const res = context.switchToHttp().getResponse<Response>();
		const currentGame: LiteratureGame = res.locals[ "currentGame" ];

		if ( !currentGame ) {
			this.logger.error( "Game Not Present!" );
			throw new NotFoundException();
		}

		if ( currentGame.status !== LiteratureGameStatus.IN_PROGRESS ) {
			this.logger.debug( "Game Present but not in progress!" );
			throw new BadRequestException();
		}

		return true;
	}
}