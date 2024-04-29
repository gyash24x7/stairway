import { LoggerFactory } from "@common/core";
import type { AskCardInput, AskMove, AskMoveData, CardsData, GameData } from "@literature/data";
import { CommandHandler, EventBus, ICommand, type ICommandHandler, QueryBus } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { MoveCreatedEvent } from "../events";
import { CardsDataQuery } from "../queries";
import { DatabaseService } from "../services";
import { Messages } from "../utils";

export class AskCardCommand implements ICommand {
	constructor(
		public readonly input: AskCardInput,
		public readonly gameData: GameData,
		public readonly currentPlayer: string
	) {}
}

@CommandHandler( AskCardCommand )
export class AskCardCommandHandler implements ICommandHandler<AskCardCommand, AskMove> {

	private readonly logger = LoggerFactory.getLogger( AskCardCommandHandler );

	constructor(
		private readonly db: DatabaseService,
		private readonly queryBus: QueryBus,
		private readonly eventBus: EventBus
	) {}

	async execute( command: AskCardCommand ) {
		this.logger.debug( ">> askCard()" );

		const { playerWithAskedCard, askedPlayer, cardsData } = await this.validate( command );
		const { input, gameData } = command;
		const currentPlayer = gameData.players[ command.currentPlayer ];

		const moveSuccess = askedPlayer.id === playerWithAskedCard.id;
		const receivedString = moveSuccess ? "got the card!" : "was declined!";
		const description = `${ currentPlayer.name } asked ${ askedPlayer.name } for ${ input.for } and ${ receivedString }`;
		const askMoveData: AskMoveData = { from: input.from, by: currentPlayer.id, card: input.for };

		const move = await this.db.createMove( {
			type: "ASK_CARD",
			playerId: currentPlayer.id,
			gameId: gameData.id,
			success: moveSuccess,
			data: askMoveData,
			description
		} );

		const event = new MoveCreatedEvent( gameData, cardsData, move );
		this.eventBus.publish( event );
		this.logger.debug( "Published MoveCreated Event!" );

		this.logger.debug( "<< askCard()" );
		return move as AskMove;
	}

	async validate( { gameData, currentPlayer, input }: AskCardCommand ) {
		this.logger.debug( ">> validateAskCardRequest()" );

		const cardsDataQuery = new CardsDataQuery( gameData.id );
		const cardsData: CardsData = await this.queryBus.execute( cardsDataQuery );

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

		if ( playerWithAskedCard.id === currentPlayer ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_CARD_WITH_ASKING_PLAYER, gameData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ASKED_CARD_WITH_ASKING_PLAYER } );
		}

		if ( gameData.players[ currentPlayer ].teamId === askedPlayer.teamId ) {
			this.logger.debug( "%s GameId: %s", Messages.ASKED_PLAYER_FROM_SAME_TEAM, gameData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ASKED_PLAYER_FROM_SAME_TEAM } );
		}

		this.logger.debug( "<< validateAskCardRequest()" );
		return { askedPlayer, playerWithAskedCard, cardsData };
	}

}