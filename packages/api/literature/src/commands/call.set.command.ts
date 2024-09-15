import { CommandHandler, EventBus, type ICommand, type ICommandHandler, QueryBus } from "@nestjs/cqrs";
import { LoggerFactory } from "@shared/api";
import { cardSetMap, PlayingCard } from "@stairway/cards";
import { TRPCError } from "@trpc/server";
import { MoveCreatedEvent } from "../events";
import { Messages } from "../literature.constants.ts";
import { LiteratureRepository } from "../literature.repository.ts";
import type { CallMove, CallMoveData, CardsData, GameData } from "../literature.types.ts";
import { CardsDataQuery } from "../queries";

export type CallSetInput = {
	gameId: string;
	data: Record<string, string>;
}

export class CallSetCommand implements ICommand {
	constructor(
		public readonly input: CallSetInput,
		public readonly gameData: GameData,
		public readonly currentPlayer: string
	) {}
}

@CommandHandler( CallSetCommand )
export class CallSetCommandHandler implements ICommandHandler<CallSetCommand, CallMove> {

	private readonly logger = LoggerFactory.getLogger( CallSetCommandHandler );

	constructor(
		private readonly repository: LiteratureRepository,
		private readonly queryBus: QueryBus,
		private readonly eventBus: EventBus
	) {}

	async execute( command: CallSetCommand ) {
		this.logger.debug( ">> callSet()" );

		const { correctCall, calledSet, cardsData } = await this.validate( command );
		const { gameData, input } = command;
		const callingPlayer = gameData.players[ command.currentPlayer ]!;

		let success = true;
		let successString = "correctly!";

		const cardsOfCallingSet = cardSetMap[ calledSet ].map( PlayingCard.from );
		for ( const card of cardsOfCallingSet ) {
			if ( correctCall[ card.id ] !== input.data[ card.id ] ) {
				success = false;
				successString = "incorrectly!";
				break;
			}
		}

		const callMoveData: CallMoveData = {
			by: callingPlayer.id,
			cardSet: calledSet,
			actualCall: input.data,
			correctCall
		};

		const move = await this.repository.createMove( {
			gameId: gameData.id,
			playerId: callingPlayer.id,
			type: "CALL_SET",
			success,
			description: `${ callingPlayer.name } called ${ calledSet } ${ successString }`,
			data: callMoveData
		} );

		this.eventBus.publish( new MoveCreatedEvent( gameData, cardsData, move ) );
		this.logger.debug( "Published MoveCreated Event!" );

		this.logger.debug( "<< callSet()" );
		return move as CallMove;
	};

	async validate( { input: { data }, gameData, currentPlayer }: CallSetCommand ) {
		this.logger.debug( ">> validateCallSetRequest()" );

		const cardsDataQuery = new CardsDataQuery( gameData.id );
		const cardsData: CardsData = await this.queryBus.execute( cardsDataQuery );

		const calledCards = Object.keys( data ).map( PlayingCard.fromId );
		const cardSets = new Set( calledCards.map( card => card.set ) );

		const calledPlayers = Array.from( new Set( Object.values( data ) ) ).map( playerId => {
			const player = gameData.players[ playerId ];
			if ( !player ) {
				this.logger.error(
					"%s GameId: %s, PlayerId: %s",
					Messages.PLAYER_NOT_PART_OF_GAME,
					gameData.id,
					playerId
				);
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_PART_OF_GAME } );
			}
			return player;
		} );

		if ( !Object.values( data ).includes( currentPlayer ) ) {
			this.logger.error( "%s UserId: %s", Messages.DIDNT_CALL_OWN_CARDS, currentPlayer );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.DIDNT_CALL_OWN_CARDS } );
		}

		if ( cardSets.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.MULTIPLE_SETS_CALLED, currentPlayer );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.MULTIPLE_SETS_CALLED } );
		}

		const [ calledSet ] = cardSets;
		const correctCall: Record<string, string> = {};
		let isCardSetWithCallingPlayer = false;

		Object.keys( cardsData.mappings ).forEach( cardId => {
			const card = PlayingCard.fromId( cardId );
			if ( card.set === calledSet ) {
				correctCall[ cardId ] = cardsData.mappings[ cardId ];
				if ( cardsData.mappings[ cardId ] === currentPlayer ) {
					isCardSetWithCallingPlayer = true;
				}
			}
		} );


		if ( !isCardSetWithCallingPlayer ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.SET_CALLED_WITHOUT_CARDS, currentPlayer, calledSet );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.SET_CALLED_WITHOUT_CARDS } );
		}

		const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

		if ( calledTeams.size !== 1 ) {
			this.logger.error( "%s UserId: %s", Messages.SET_CALLED_FROM_MULTIPLE_TEAMS, currentPlayer );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.SET_CALLED_FROM_MULTIPLE_TEAMS } );
		}

		if ( calledCards.length !== 6 ) {
			this.logger.error( "%s UserId: %s, Set: %s", Messages.ALL_CARDS_NOT_CALLED, currentPlayer, calledSet );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.ALL_CARDS_NOT_CALLED } );
		}

		this.logger.debug( "<< validateCallSetRequest()" );
		return { correctCall, calledSet, cardsData };
	}

}