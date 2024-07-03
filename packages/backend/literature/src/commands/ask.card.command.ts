import { LoggerFactory } from "@backend/utils";
import { PlayingCard } from "@common/cards";
import { CommandHandler, EventBus, type ICommand, type ICommandHandler, QueryBus } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { MoveCreatedEvent } from "../events";
import { Messages } from "../literature.constants.ts";
import { LiteratureRepository } from "../literature.repository.ts";
import type { AskMove, AskMoveData, CardsData, GameData } from "../literature.types.ts";
import { CardsDataQuery } from "../queries";

export type AskCardInput = {
	gameId: string;
	from: string;
	for: string;
}

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
		private readonly repository: LiteratureRepository,
		private readonly queryBus: QueryBus,
		private readonly eventBus: EventBus
	) {}

	async execute( command: AskCardCommand ) {
		this.logger.debug( ">> askCard()" );

		const { playerWithAskedCard, askedPlayer, cardsData } = await this.validate( command );
		const { input, gameData } = command;
		const askedCard = PlayingCard.fromId( input.for );
		const currentPlayer = gameData.players[ command.currentPlayer ];

		const moveSuccess = askedPlayer.id === playerWithAskedCard.id;
		const receivedString = moveSuccess ? "got the card!" : "was declined!";
		const description = `${ currentPlayer.name } asked ${ askedPlayer.name } for ${ askedCard.displayString } and ${ receivedString }`;
		const askMoveData: AskMoveData = { from: input.from, by: currentPlayer.id, card: input.for };

		const move = await this.repository.createMove( {
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