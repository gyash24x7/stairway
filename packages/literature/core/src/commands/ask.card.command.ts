import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { AggregatedGameData, AskCardInput, AskMoveData } from "@literature/data";
import { MoveType } from "@literature/data";
import { BadRequestException } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import type { UserAuthInfo } from "@auth/data";
import { PrismaService } from "../services";
import { GameUpdateEvent, MoveCreatedEvent } from "../events";

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
			this.logger.debug( "The asked player doesn't exist! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		if ( askingPlayer.teamId! === askedPlayer.teamId! ) {
			this.logger.debug( "The asked player is from the same team! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		if ( playerWithAskedCard.id === askingPlayer.id ) {
			this.logger.debug( "The asked card is with asking player itself! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		const moveSuccess = askedPlayer.id === playerWithAskedCard.id;
		const receivedString = moveSuccess ? "got the card!" : "was declined!";
		const description = `${ askingPlayer.name } asked ${ askedPlayer.name } for ${ input.askedFor } and ${ receivedString }`;
		const moveData: AskMoveData = {
			from: input.askedFrom,
			by: authInfo.id,
			card: input.askedFor
		};

		const move = await this.prisma.move.create( {
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
			await this.prisma.cardMapping.update( {
				where: { cardId_gameId: { cardId: input.askedFor, gameId: currentGame.id } },
				data: { playerId: askingPlayer.id }
			} );

			currentGame.cardMappings[ input.askedFor ] = askingPlayer.id;

		} else {
			await this.prisma.game.update( {
				where: { id: currentGame.id },
				data: { currentTurn: askedPlayer.id }
			} );

			currentGame.currentTurn = askedPlayer.id;
		}

		this.eventBus.publish( new GameUpdateEvent( currentGame, authInfo ) );

		return currentGame.id;
	}
}