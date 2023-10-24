import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type {
	CardMappingData,
	GameData,
	PlayerSpecificData,
	TransferChanceInput,
	TransferMove,
	TransferMoveData
} from "@literature/types";
import { MoveType } from "@literature/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { BadRequestException } from "@nestjs/common";
import { MoveCreatedEvent } from "../events";
import { Messages } from "../constants";
import { buildHandData } from "../utils";

export class TransferChanceCommand implements ICommand {
	constructor(
		public readonly input: TransferChanceInput,
		public readonly gameData: GameData,
		public readonly playerData: PlayerSpecificData,
		public readonly cardMappings: CardMappingData
	) {}
}

@CommandHandler( TransferChanceCommand )
export class TransferChanceCommandHandler implements ICommandHandler<TransferChanceCommand, TransferMove> {

	private readonly logger = LoggerFactory.getLogger( TransferChanceCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( command: TransferChanceCommand ) {
		this.logger.debug( ">> executeTransferChanceCommand()" );

		const { input, gameData, cardMappings } = command;
		const { transferringPlayer, receivingPlayer } = this.validate( command );

		const transferMoveData: TransferMoveData = { to: input.transferTo, from: transferringPlayer.id };
		const description = `${ transferringPlayer.name } transferred the chance to ${ receivingPlayer.name }`;

		const move = await this.prisma.literature.move.create( {
			data: {
				gameId: gameData.id,
				type: MoveType.TRANSFER_CHANCE,
				success: true,
				data: transferMoveData,
				description
			}
		} );

		this.eventBus.publish( new MoveCreatedEvent( move, gameData, cardMappings ) );
		this.logger.debug( "Published MoveCreatedEvent!" );
		
		this.logger.debug( "<< executeTransferChanceCommand()" );
		return { ...move, data: transferMoveData };
	}

	private validate( { gameData, cardMappings, input, playerData }: TransferChanceCommand ) {
		this.logger.debug( ">> validateTransferChanceCommand()" );

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

		this.logger.debug( "<< validateTransferChanceCommand()" );
		return { transferringPlayer, receivingPlayer };
	}
}