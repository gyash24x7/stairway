import type {
	CardMappingData,
	GameData,
	PlayerSpecificData,
	TransferMove,
	TransferMoveData,
	TransferTurnInput
} from "@literature/types";
import { MoveType } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { MoveCreatedEvent } from "../events";
import { TransferTurnValidator } from "../validators";

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
		private readonly validator: TransferTurnValidator,
		private readonly eventBus: EventBus
	) {}

	async execute( command: TransferTurnCommand ) {
		this.logger.debug( ">> executeTransferTurnCommand()" );

		const { input, gameData, cardMappings } = command;
		const { transferringPlayer, receivingPlayer } = await this.validator.validate( command );

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
}