import type { AskCardInput, AskMove, AskMoveData, CardsData, GameData, PlayerSpecificData } from "@literature/types";
import { MoveType } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { MoveCreatedEvent } from "../events";
import { AskCardValidator } from "../validators";

export class AskCardCommand implements ICommand {
	constructor(
		public readonly input: AskCardInput,
		public readonly gameData: GameData,
		public readonly playerData: PlayerSpecificData,
		public readonly cardsData: CardsData
	) {}
}

@CommandHandler( AskCardCommand )
export class AskCardCommandHandler implements ICommandHandler<AskCardCommand, AskMove> {

	private readonly logger = LoggerFactory.getLogger( AskCardCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly validator: AskCardValidator,
		private readonly eventBus: EventBus
	) {}

	async execute( command: AskCardCommand ) {
		this.logger.debug( ">> executeAskCardCommand()" );

		const { input, playerData, gameData, cardsData } = command;
		const { playerWithAskedCard, askedPlayer } = await this.validator.validate( command );

		const moveSuccess = askedPlayer.id === playerWithAskedCard.id;
		const receivedString = moveSuccess ? "got the card!" : "was declined!";
		const description = `${ playerData.name } asked ${ askedPlayer.name } for ${ input.askedFor } and ${ receivedString }`;
		const askMoveData: AskMoveData = {
			from: input.askedFrom,
			by: playerData.id,
			card: input.askedFor
		};

		const move = await this.prisma.literature.move.create( {
			data: {
				type: MoveType.ASK_CARD,
				gameId: gameData.id,
				success: moveSuccess,
				data: askMoveData,
				description
			}
		} );

		this.eventBus.publish( new MoveCreatedEvent( move, gameData, cardsData ) );
		this.logger.debug( "Published MoveCreatedEvent!" );

		this.logger.debug( "<< executeAskCardCommand()" );
		return { ...move, data: askMoveData };
	}
}