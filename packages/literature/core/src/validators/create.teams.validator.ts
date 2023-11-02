import { BadRequestException, Injectable } from "@nestjs/common";
import type { BusinessValidator } from "@s2h/core";
import { LoggerFactory } from "@s2h/core";
import type { CreateTeamsCommand } from "../commands";
import { Messages } from "../constants";

@Injectable()
export class CreateTeamsValidator implements BusinessValidator<CreateTeamsCommand, void> {

	private readonly logger = LoggerFactory.getLogger( CreateTeamsValidator );

	async validate( { gameData }: CreateTeamsCommand ) {
		this.logger.debug( ">> validateCreateTeamsCommand()" );

		if ( Object.keys( gameData.players ).length !== gameData.playerCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS, gameData.id );
			throw new BadRequestException( Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS );
		}

		this.logger.debug( "<< validateCreateTeamsCommand()" );
	}
}