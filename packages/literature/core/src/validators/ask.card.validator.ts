import type { Player } from "@literature/types";
import { BadRequestException, Injectable } from "@nestjs/common";
import { BusinessValidator, LoggerFactory } from "@s2h/core";
import type { AskCardCommand } from "../commands";
import { Messages } from "../constants";


export type AskCardValidatorResponse = {
	askedPlayer: Player;
	playerWithAskedCard: Player;
}

@Injectable()
export class AskCardValidator implements BusinessValidator<AskCardCommand, AskCardValidatorResponse> {

	private readonly logger = LoggerFactory.getLogger( AskCardValidator );

	async validate( { gameData, playerData, cardsData, input }: AskCardCommand ) {
		this.logger.debug( ">> validateAskCardCommand()" );

		const askedPlayer = gameData.players[ input.askedFrom ];
		const playerWithAskedCard = gameData.players[ cardsData.mappings[ input.askedFor ] ];

		if ( !askedPlayer ) {
			this.logger.debug(
				"%s GameId: %s, PlayerId: %s",
				Messages.PLAYER_NOT_PART_OF_GAME,
				gameData.id,
				input.askedFrom
			);
			throw new BadRequestException( Messages.PLAYER_NOT_PART_OF_GAME );
		}

		if ( playerWithAskedCard.id === playerData.id ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_CARD_WITH_ASKING_PLAYER, gameData.id );
			throw new BadRequestException( Messages.ASKED_CARD_WITH_ASKING_PLAYER );
		}

		if ( playerData.teamId === askedPlayer.teamId ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_PLAYER_FROM_SAME_TEAM, gameData.id );
			throw new BadRequestException( Messages.ASKED_PLAYER_FROM_SAME_TEAM );
		}

		this.logger.debug( "<< validateAskCardCommand()" );
		return { askedPlayer, playerWithAskedCard };
	}
}