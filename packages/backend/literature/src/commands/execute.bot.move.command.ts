import { LoggerFactory } from "@backend/utils";
import { CardHand, CardSet, cardSetMap, PlayingCard, shuffle } from "@common/cards";
import { CommandBus, CommandHandler, type ICommand, type ICommandHandler, QueryBus } from "@nestjs/cqrs";
import { Constants } from "../literature.constants.ts";
import type {
	AskMove,
	CallMove,
	CardLocation,
	CardLocationsData,
	CardsData,
	GameData,
	Move,
	TransferMove
} from "../literature.types.ts";
import { CardLocationsDataQuery, CardsDataQuery } from "../queries";
import { AskCardCommand, type AskCardInput } from "./ask.card.command";
import { CallSetCommand, type CallSetInput } from "./call.set.command";
import { TransferTurnCommand, type TransferTurnInput } from "./transfer.turn.command";

// TODO:
// Auto execute bot move
// Infer card of other player by what is asked and previous moves
// Prefer recently asked card set when a tie

// Animation
// Improve Display Player


export class ExecuteBotMoveCommand implements ICommand {
	constructor(
		public readonly gameData: GameData,
		public readonly currentPlayer: string
	) {}
}

type WeightedAsk = { cardId: string, playerId: string, weight: number }

type WeightedCall = { cardSet: CardSet, callData: Record<string, string>, weight: number }

type WeightedTransfer = { weight: number, transferTo: string };

type WeightedCardSet = { cardSet: CardSet, weight: number };

@CommandHandler( ExecuteBotMoveCommand )
export class ExecuteBotMoveCommandHandler implements ICommandHandler<ExecuteBotMoveCommand, Move> {

	private readonly logger = LoggerFactory.getLogger( ExecuteBotMoveCommandHandler );

	constructor(
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus
	) {}

	async execute( { gameData, currentPlayer }: ExecuteBotMoveCommand ) {
		this.logger.debug( ">> executeBotMove()" );

		const cardLocationsDataQuery = new CardLocationsDataQuery( gameData.id, currentPlayer );
		const cardLocationsData: CardLocationsData = await this.queryBus.execute( cardLocationsDataQuery );

		const cardsDataQuery = new CardsDataQuery( gameData.id, currentPlayer );
		const cardsData: CardsData = await this.queryBus.execute( cardsDataQuery );

		const hand = cardsData.hands[ currentPlayer ];
		const cardLocations = cardLocationsData[ currentPlayer ];
		const cardSets = this.suggestCardSets( cardLocationsData[ currentPlayer ] );
		const lastMove = gameData.moves[ 0 ];

		if ( lastMove.type === "CALL_SET" && lastMove.success && lastMove.playerId === currentPlayer ) {
			this.logger.info( "Last Move was a successful call! Can transfer chance!" );
			const transfers = this.suggestTransfer( gameData, currentPlayer );

			if ( transfers.length > 0 ) {
				const input: TransferTurnInput = { transferTo: transfers[ 0 ].transferTo, gameId: gameData.id };
				const transferTurnCommand = new TransferTurnCommand( input, gameData, currentPlayer );
				const transferMove: TransferMove = await this.commandBus.execute( transferTurnCommand );

				this.logger.debug( "<< executeBotMove()" );
				return transferMove;
			}
		}

		const calls = this.suggestCalls( gameData, currentPlayer, cardSets, cardLocations, hand );

		if ( calls.length > 0 ) {
			const input: CallSetInput = { gameId: gameData.id, data: calls[ 0 ].callData };
			const callSetCommand = new CallSetCommand( input, gameData, currentPlayer );
			const callMove: CallMove = await this.commandBus.execute( callSetCommand );

			this.logger.debug( "<< executeBotMove()" );
			return callMove;
		}

		const asks = this.suggestAsks( gameData, currentPlayer, cardSets, cardLocations, hand );

		if ( asks.length === 0 ) {}

		const [ bestAsk ] = asks;
		const input: AskCardInput = { from: bestAsk.playerId, for: bestAsk.cardId, gameId: gameData.id };

		const askCardCommand = new AskCardCommand( input, gameData, currentPlayer );
		const askMove: AskMove = await this.commandBus.execute( askCardCommand );

		this.logger.debug( "<< executeBotMove()" );
		return askMove;
	}

	suggestCardSets( cardLocations: CardLocation[] ): CardSet[] {
		const weightedCardSets: WeightedCardSet[] = [];
		const cardSetsInGame = new Set( cardLocations.map( l => PlayingCard.fromId( l.cardId ).set ) );

		for ( const cardSet of cardSetsInGame ) {
			let weight = 0;
			const cardsOfSet = cardSetMap[ cardSet ].map( PlayingCard.from );

			for ( const card of cardsOfSet ) {
				const cardLocation = cardLocations.find( ( { cardId } ) => cardId === card.id );

				if ( !cardLocation || cardLocation.playerIds.length === 0 ) {
					continue;
				}

				weight += Constants.MAX_ASK_WEIGHT / cardLocation.playerIds.length;
			}

			weightedCardSets.push( { cardSet, weight } );
		}

		this.logger.info( "Weighted CardSets: %o", weightedCardSets.sort( ( a, b ) => b.weight - a.weight ) );

		return weightedCardSets.map( w => w.cardSet );
	}

	suggestTransfer( gameData: GameData, currentPlayer: string ): WeightedTransfer[] {
		const teamId = gameData.players[ currentPlayer ].teamId;
		const myTeamMembers = Object.values( gameData.players )
			.filter( player => player.teamId === teamId && player.id !== currentPlayer )
			.filter( player => gameData.cardCounts[ player.id ] > 0 )
			.map( player => player.id );

		const weightedTransfers = myTeamMembers.map( transferTo => {
			return { weight: 720 / myTeamMembers.length + gameData.cardCounts[ transferTo ], transferTo };
		} );

		this.logger.debug( "Weighted Transfers: %o", weightedTransfers );

		return weightedTransfers.toSorted( ( a, b ) => b.weight - a.weight );
	}

	canCardSetBeCalled(
		gameData: GameData,
		currentPlayer: string,
		cardSet: CardSet,
		cardLocations: CardLocation[],
		hand: CardHand
	) {
		const teamId = gameData.players[ currentPlayer ].teamId;
		const oppositeTeamMembers = Object.values( gameData.players )
			.filter( player => player.teamId !== teamId )
			.map( player => player.id );

		const cardsOfSet = shuffle( cardSetMap[ cardSet ].map( PlayingCard.from ) );
		const cardPossibilityMap: Record<string, string[]> = {};

		let isCardSetWithUs = true;
		for ( const card of cardsOfSet ) {
			const isCardInHand = hand.cards.map( card => card.id ).includes( card.id );

			if ( isCardInHand ) {
				cardPossibilityMap[ card.id ] = [ currentPlayer ];
				continue;
			}

			const cardLocation = cardLocations.find( ( { cardId } ) => cardId === card.id );

			if ( !cardLocation || cardLocation.playerIds.length === 0 ) {
				continue;
			}

			cardPossibilityMap[ card.id ] = cardLocation.playerIds;
			cardLocation.playerIds.filter( playerId => gameData.cardCounts[ playerId ] > 0 ).forEach(
				playerId => {
					if ( oppositeTeamMembers.includes( playerId ) ) {
						isCardSetWithUs = false;
					}
				}
			);
		}

		const totalCardsCalled = Object.keys( cardPossibilityMap ).length;
		const canCardSetBeCalled = isCardSetWithUs && totalCardsCalled === 6;

		return [ canCardSetBeCalled, cardPossibilityMap ] as const;
	}

	suggestCalls(
		gameData: GameData,
		currentPlayer: string,
		cardSetsInGame: CardSet[],
		cardLocations: CardLocation[],
		hand: CardHand
	) {
		const weightedCalls: WeightedCall[] = [];

		for ( const cardSet of cardSetsInGame ) {
			const cardsOfSet = shuffle( cardSetMap[ cardSet ].map( PlayingCard.from ) );
			const [ canCardSetBeCalled, cardPossibilityMap ] =
				this.canCardSetBeCalled( gameData, currentPlayer, cardSet, cardLocations, hand );

			if ( !canCardSetBeCalled ) {
				this.logger.info( "This card set is not with my team. Cannot Call! CardSet: %s", cardSet );
				continue;
			}

			const totalPossiblePlayers = Object.values( cardPossibilityMap ).flat().length;
			let weight = Constants.MAX_ASK_WEIGHT;

			if ( totalPossiblePlayers > 6 ) {
				weight /= totalPossiblePlayers - 6;
			}

			const callData: Record<string, string> = {};
			for ( const card of cardsOfSet ) {
				const callablePlayersForCard = cardPossibilityMap[ card.id ]
					.filter( playerId => gameData.cardCounts[ playerId ] > 0 );

				const randIdx = Math.floor( Math.random() * callablePlayersForCard.length );
				callData[ card.id ] = callablePlayersForCard[ randIdx ];
			}

			weightedCalls.push( { callData, weight, cardSet } );
		}

		this.logger.debug( "Weighted Calls: %o", weightedCalls );

		return weightedCalls.toSorted( ( a, b ) => b.weight - a.weight );
	}

	suggestAsks(
		gameData: GameData,
		currentPlayer: string,
		cardSets: CardSet[],
		cardLocations: CardLocation[],
		hand: CardHand
	) {
		const teamId = gameData.players[ currentPlayer ].teamId;
		const oppositeTeamMembers = Object.values( gameData.players )
			.filter( player => player.teamId !== teamId )
			.map( player => player.id );

		const weightedAskMap: Record<string, WeightedAsk[]> = {};
		const weightedAsks: WeightedAsk[] = [];

		for ( const cardSet of cardSets ) {
			if ( !hand.sets.has( cardSet ) ) {
				continue;
			}

			const cardsOfSet = shuffle( hand.getAskableCardsOfSet( cardSet ) );
			weightedAskMap[ cardSet ] = [];

			for ( const card of cardsOfSet ) {
				const cardLocation = cardLocations.find( ( { cardId } ) => cardId === card.id );

				if ( !cardLocation || cardLocation.playerIds.length === 0 ) {
					continue;
				}

				const possibleAsks: WeightedAsk[] = cardLocation.playerIds
					.filter( playerId => oppositeTeamMembers.includes( playerId ) )
					.filter( playerId => gameData.cardCounts[ playerId ] > 0 )
					.map( playerId => {
						const weight = Constants.MAX_ASK_WEIGHT / cardLocation.playerIds.length;
						return { cardId: card.id, playerId, weight };
					} );

				weightedAskMap[ cardSet ].push( ...shuffle( possibleAsks ) );
			}

			weightedAskMap[ cardSet ].sort( ( a, b ) => b.weight - a.weight );
			weightedAsks.push( ...weightedAskMap[ cardSet ] );
		}

		return weightedAsks;
	}
}