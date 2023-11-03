import { BadRequestException, Injectable } from "@nestjs/common";
import { type BusinessValidator, LoggerFactory } from "@s2h/core";
import type { AddBotsCommand } from "../commands";
import { Messages } from "../constants";

@Injectable()
export class AddBotsValidator implements BusinessValidator<AddBotsCommand, number> {

	private readonly logger = LoggerFactory.getLogger( AddBotsValidator );

	async validate( { gameData }: AddBotsCommand ) {
		this.logger.debug( ">> validateAddBotsCommand()" );

		const remainingPlayers = gameData.playerCount - Object.keys( gameData.players ).length;

		if ( remainingPlayers <= 0 ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, gameData.id );
			throw new BadRequestException( Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS );
		}

		this.logger.debug( "<< validateAddBotsCommand()" );
		return remainingPlayers;
	}
}