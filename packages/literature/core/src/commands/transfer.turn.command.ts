import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type {
	CardMappingData,
	GameData,
	PlayerSpecificData,
	TransferMove,
	TransferMoveData,
	TransferTurnInput
} from "@literature/types";
import { MoveType } from "@literature/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { BadRequestException } from "@nestjs/common";
import { MoveCreatedEvent } from "../events";
import { Messages } from "../constants";
import { buildHandData } from "../utils";

export class TransferTurnCommand implements ICommand {
	constructor(
		public readonly input: TransferTurnInput,
		public readonly gameData: GameData,
		public readonly playerData: PlayerSpecificData,
		public readonly cardMappings: CardMappingData
	) {}
}

@CommandHandler( TransferTurnCommand )
export class TransferTurnCommandHandler implements ICommandHandler<TransferTurnCommand, TransferMove> {

	private readonly logger = LoggerFactory.getLogger( TransferTurnCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( command: TransferTurnCommand ) {
		this.logger.debug( ">> executeTransferTurnCommand()" );

		const { input, gameData, cardMappings } = command;
		const { transferringPlayer, receivingPlayer } = this.validate( command );

		const transferMoveData: TransferMoveData = { to: input.transferTo, from: transferringPlayer.id };
		const description = `${ transferringPlayer.name } transferred the turn to ${ receivingPlayer.name }`;

		const move = await this.prisma.literature.move.create( {
			data: {
				gameId: gameData.id,
				type: MoveType.TRANSFER_TURN,
				success: true,
				data: transferMoveData,
				description
			}
		} );

		this.eventBus.publish( new MoveCreatedEvent( move, gameData, cardMappings ) );
		this.logger.debug( "Published MoveCreatedEvent!" );

		this.logger.debug( "<< executeTransferTurnCommand()" );
		return { ...move, data: transferMoveData };
	}

	private validate( { gameData, cardMappings, input, playerData }: TransferTurnCommand ) {
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