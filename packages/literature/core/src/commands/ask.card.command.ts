import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { AggregatedGameData, AskCardInput, AskMoveData } from "@literature/data";
import { MoveType } from "@literature/data";
import { BadRequestException } from "@nestjs/common";
import { LoggerFactory, PrismaService } from "@s2h/core";
import type { UserAuthInfo } from "@auth/data";
import { GameUpdateEvent, MoveCreatedEvent } from "../events";
import { Messages } from "../constants";
import { rebuildHands } from "../utils";

export class AskCardCommand implements ICommand {
	constructor(
		public readonly input: AskCardInput,
		public readonly currentGame: AggregatedGameData,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( AskCardCommand )
export class AskCardCommandHandler implements ICommandHandler<AskCardCommand, string> {

	private readonly logger = LoggerFactory.getLogger( AskCardCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { input, currentGame, authInfo }: AskCardCommand ) {
		const askingPlayer = currentGame.players[ authInfo.id ];
		const askedPlayer = currentGame.players[ input.askedFrom ];
		const playerWithAskedCard = currentGame.players[ currentGame.cardMappings[ input.askedFor ] ];

		if ( !askedPlayer ) {
			this.logger.debug(
				"%s GameId: %s, PlayerId: %s",
				Messages.PLAYER_NOT_PART_OF_GAME,
				currentGame.id,
				input.askedFrom
			);
			throw new BadRequestException( Messages.PLAYER_NOT_PART_OF_GAME );
		}

		if ( playerWithAskedCard.id === askingPlayer.id ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_CARD_WITH_ASKING_PLAYER, currentGame.id );
			throw new BadRequestException( Messages.ASKED_CARD_WITH_ASKING_PLAYER );
		}

		if ( askingPlayer.teamId! === askedPlayer.teamId! ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_PLAYER_FROM_SAME_TEAM, currentGame.id );
			throw new BadRequestException( Messages.ASKED_PLAYER_FROM_SAME_TEAM );
		}

		const moveSuccess = askedPlayer.id === playerWithAskedCard.id;
		const receivedString = moveSuccess ? "got the card!" : "was declined!";
		const description = `${ askingPlayer.name } asked ${ askedPlayer.name } for ${ input.askedFor } and ${ receivedString }`;
		const moveData: AskMoveData = {
			from: input.askedFrom,
			by: authInfo.id,
			card: input.askedFor
		};

		const move = await this.prisma.literature.move.create( {
			data: {
				type: MoveType.ASK_CARD,
				gameId: currentGame.id,
				success: moveSuccess,
				data: moveData,
				description
			}
		} );

		currentGame.moves = [ move, ...currentGame.moves ];

		this.eventBus.publish( new MoveCreatedEvent( move ) );

		if ( moveSuccess ) {
			await this.prisma.literature.cardMapping.update( {
				where: { cardId_gameId: { cardId: input.askedFor, gameId: currentGame.id } },
				data: { playerId: askingPlayer.id }
			} );

			currentGame.cardMappings[ input.askedFor ] = askingPlayer.id;
			currentGame.hands = rebuildHands( currentGame.cardMappings );

		} else {
			await this.prisma.literature.game.update( {
				where: { id: currentGame.id },
				data: { currentTurn: askedPlayer.id }
			} );

			currentGame.currentTurn = askedPlayer.id;
		}

		this.eventBus.publish( new GameUpdateEvent( currentGame, authInfo ) );

		return currentGame.id;
	}
}