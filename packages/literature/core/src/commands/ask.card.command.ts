import { LoggerFactory } from "@common/core";
import type { AskCardInput, AskMove, AskMoveData, CardsData, GameData, PlayerSpecificData } from "@literature/data";
import { CommandHandler, EventBus, ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { MoveCreatedEvent } from "../events";
import { DatabaseService } from "../services";
import { Messages } from "../utils";

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
		private readonly db: DatabaseService,
		private readonly eventBus: EventBus
	) {}

	async execute( command: AskCardCommand ) {
		this.logger.debug( ">> askCard()" );

		const { playerWithAskedCard, askedPlayer } = await this.validate( command );
		const { input, gameData, playerData, cardsData } = command;

		const moveSuccess = askedPlayer.id === playerWithAskedCard.id;
		const receivedString = moveSuccess ? "got the card!" : "was declined!";
		const description = `${ playerData.name } asked ${ askedPlayer.name } for ${ input.for } and ${ receivedString }`;
		const askMoveData: AskMoveData = { from: input.from, by: playerData.id, card: input.for };

		const move = await this.db.createMove( {
			type: "ASK_CARD",
			gameId: gameData.id,
			success: moveSuccess,
			data: askMoveData,
			description
		} );

		this.eventBus.publish( new MoveCreatedEvent( gameData, cardsData, move ) );
		this.logger.debug( "Published MoveCreated Event!" );

		this.logger.debug( "<< askCard()" );
		return move as AskMove;
	}

	async validate( { gameData, playerData, cardsData, input }: AskCardCommand ) {
		this.logger.debug( ">> validateAskCardRequest()" );

		const askedPlayer = gameData.players[ input.from ];
		const playerWithAskedCard = gameData.players[ cardsData.mappings[ input.for ] ];

		if ( !askedPlayer ) {
			this.logger.debug(
				"%s GameId: %s, PlayerId: %s",
				Messages.PLAYER_NOT_PART_OF_GAME,
				gameData.id,
				input.from
			);
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_PART_OF_GAME } );
		}

		if ( playerWithAskedCard.id === playerData.id ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_CARD_WITH_ASKING_PLAYER, gameData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ASKED_CARD_WITH_ASKING_PLAYER } );
		}

		if ( playerData.teamId === askedPlayer.teamId ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_PLAYER_FROM_SAME_TEAM, gameData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ASKED_PLAYER_FROM_SAME_TEAM } );
		}

		this.logger.debug( "<< validateAskCardRequest()" );
		return { askedPlayer, playerWithAskedCard };
	}

}