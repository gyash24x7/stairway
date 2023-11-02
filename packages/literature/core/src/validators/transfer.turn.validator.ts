import { MoveType, Player } from "@literature/types";
import { BadRequestException, Injectable } from "@nestjs/common";
import type { BusinessValidator } from "@s2h/core";
import { LoggerFactory } from "@s2h/core";
import type { TransferTurnCommand } from "../commands";
import { Messages } from "../constants";
import { buildHandData } from "../utils";

export type TransferTurnValidatorResponse = {
	transferringPlayer: Player;
	receivingPlayer: Player;
};

@Injectable()
export class TransferTurnValidator implements BusinessValidator<TransferTurnCommand, TransferTurnValidatorResponse> {

	private readonly logger = LoggerFactory.getLogger( TransferTurnValidator );

	async validate( { gameData, cardMappings, input, playerData }: TransferTurnCommand ) {
		this.logger.debug( ">> validateTransferTurnCommand()" );

		const [ lastMove ] = gameData.moves;
		const hands = buildHandData( cardMappings );

		if ( lastMove.type !== MoveType.CALL_SET || !lastMove.success ) {
			this.logger.error( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
			throw new BadRequestException( Messages.TRANSFER_AFTER_SUCCESSFUL_CALL );
		}

		const transferringPlayer = gameData.players[ playerData.id ];
		const receivingPlayer = gameData.players[ input.transferTo ];
		const receivingPlayerHand = hands[ input.transferTo ] ?? [];

		if ( !receivingPlayer ) {
			this.logger.error( Messages.PLAYER_NOT_PART_OF_GAME );
			throw new BadRequestException( Messages.PLAYER_NOT_PART_OF_GAME );
		}

		if ( receivingPlayerHand.length === 0 ) {
			this.logger.error( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
			throw new BadRequestException( Messages.NO_CARDS_WITH_RECEIVING_PLAYER );
		}

		if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
			this.logger.error( Messages.TRANSFER_TO_OPPONENT_TEAM );
			throw new BadRequestException( Messages.TRANSFER_TO_OPPONENT_TEAM );
		}

		this.logger.debug( "<< validateTransferTurnCommand()" );
		return { transferringPlayer, receivingPlayer };
	}
}