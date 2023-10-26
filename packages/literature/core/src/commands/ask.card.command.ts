import type {
	AskCardInput,
	AskMove,
	AskMoveData,
	CardMappingData,
	GameData,
	PlayerSpecificData
} from "@literature/types";
import { MoveType } from "@literature/types";
import { BadRequestException } from "@nestjs/common";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { Messages } from "../constants";
import { MoveCreatedEvent } from "../events";

export class AskCardCommand implements ICommand {
	constructor(
		public readonly input: AskCardInput,
		public readonly gameData: GameData,
		public readonly playerData: PlayerSpecificData,
		public readonly cardMappings: CardMappingData
	) {}
}

@CommandHandler( AskCardCommand )
export class AskCardCommandHandler implements ICommandHandler<AskCardCommand, AskMove> {

	private readonly logger = LoggerFactory.getLogger( AskCardCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( command: AskCardCommand ) {
		this.logger.debug( ">> executeAskCardCommand()" );

		const { input, playerData, gameData, cardMappings } = command;
		const { askingPlayer, playerWithAskedCard, askedPlayer } = this.validate( command );

		const moveSuccess = askedPlayer.id === playerWithAskedCard.id;
		const receivedString = moveSuccess ? "got the card!" : "was declined!";
		const description = `${ askingPlayer.name } asked ${ askedPlayer.name } for ${ input.askedFor } and ${ receivedString }`;
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

		this.eventBus.publish( new MoveCreatedEvent( move, gameData, cardMappings ) );
		this.logger.debug( "Published MoveCreatedEvent!" );

		this.logger.debug( "<< executeAskCardCommand()" );
		return { ...move, data: askMoveData };
	}

	private validate( { gameData, playerData, cardMappings, input }: AskCardCommand ) {
		this.logger.debug( ">> validateAskCardCommand()" );

		const askingPlayer = gameData.players[ playerData.id ];
		const askedPlayer = gameData.players[ input.askedFrom ];
		const playerWithAskedCard = gameData.players[ cardMappings[ input.askedFor ] ];

		if ( !askedPlayer ) {
			this.logger.debug(
				"%s GameId: %s, PlayerId: %s",
				Messages.PLAYER_NOT_PART_OF_GAME,
				gameData.id,
				input.askedFrom
			);
			throw new BadRequestException( Messages.PLAYER_NOT_PART_OF_GAME );
		}

		if ( playerWithAskedCard.id === askingPlayer.id ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_CARD_WITH_ASKING_PLAYER, gameData.id );
			throw new BadRequestException( Messages.ASKED_CARD_WITH_ASKING_PLAYER );
		}

		if ( askingPlayer.teamId! === askedPlayer.teamId! ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_PLAYER_FROM_SAME_TEAM, gameData.id );
			throw new BadRequestException( Messages.ASKED_PLAYER_FROM_SAME_TEAM );
		}

		this.logger.debug( "<< validateAskCardCommand()" );
		return { askedPlayer, askingPlayer, playerWithAskedCard };
	}
}