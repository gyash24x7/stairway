import { Injectable } from "@nestjs/common";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import { CardHand, CardSet, cardSetMap, PlayingCard, shuffle } from "@stairway/cards";
import { format } from "node:util";
import { Constants } from "./literature.constants.ts";
import type { CardCounts, CardLocation, Game, PlayerData } from "./literature.types.ts";

type WeightedAsk = { cardId: string, playerId: string, weight: number }
type WeightedCall = { cardSet: CardSet, callData: Record<string, string>, weight: number }
type WeightedTransfer = { weight: number, transferTo: string };
type WeightedCardSet = { cardSet: CardSet, weight: number };

@Injectable()
export class LiteratureBotService {

	constructor( @OgmaLogger( LiteratureBotService ) private readonly logger: OgmaService ) {}

	suggestCardSets( cardLocations: CardLocation[], hand: CardHand ): CardSet[] {
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

		this.logger.info( format( "Weighted CardSets: %o", weightedCardSets.sort( ( a, b ) => b.weight - a.weight ) ) );

		return weightedCardSets.map( w => w.cardSet )
			.filter( ( cardSet ) => hand.getCardsOfSet( cardSet ).length > 0 );
	}

	suggestTransfer( game: Game, players: PlayerData, cardCounts: CardCounts ): WeightedTransfer[] {
		const teamId = players[ game.currentTurn ].teamId;
		const myTeamMembers = Object.values( players )
			.filter( player => player.teamId === teamId && player.id !== game.currentTurn )
			.filter( player => cardCounts[ player.id ] > 0 )
			.map( player => player.id );

		const weightedTransfers = myTeamMembers.map( transferTo => {
			return { weight: 720 / myTeamMembers.length + cardCounts[ transferTo ], transferTo };
		} );

		this.logger.debug( format( "Weighted Transfers: %o", weightedTransfers ) );
		return weightedTransfers.toSorted( ( a, b ) => b.weight - a.weight );
	}

	canCardSetBeCalled(
		game: Game,
		players: PlayerData,
		cardCounts: CardCounts,
		cardSet: CardSet,
		cardLocations: CardLocation[],
		hand: CardHand
	) {
		const teamId = players[ game.currentTurn ].teamId;
		const oppositeTeamMembers = Object.values( players )
			.filter( player => player.teamId !== teamId )
			.map( player => player.id );

		const cardsOfSet = shuffle( cardSetMap[ cardSet ].map( PlayingCard.from ) );
		const cardPossibilityMap: Record<string, string[]> = {};

		let isCardSetWithUs = true;
		for ( const card of cardsOfSet ) {
			const isCardInHand = hand.cardIds.includes( card.id );

			if ( isCardInHand ) {
				cardPossibilityMap[ card.id ] = [ game.currentTurn ];
				continue;
			}

			const cardLocation = cardLocations.find( ( { cardId } ) => cardId === card.id );

			if ( !cardLocation || cardLocation.playerIds.length === 0 ) {
				continue;
			}

			cardPossibilityMap[ card.id ] = cardLocation.playerIds;
			cardLocation.playerIds.filter( playerId => cardCounts[ playerId ] > 0 ).forEach( playerId => {
				if ( oppositeTeamMembers.includes( playerId ) ) {
					isCardSetWithUs = false;
				}
			} );
		}

		const totalCardsCalled = Object.keys( cardPossibilityMap ).length;
		const canCardSetBeCalled = isCardSetWithUs && totalCardsCalled === 6;

		return [ canCardSetBeCalled, cardPossibilityMap ] as const;
	}

	suggestCalls(
		game: Game,
		players: PlayerData,
		cardCounts: CardCounts,
		cardSetsInGame: CardSet[],
		cardLocations: CardLocation[],
		hand: CardHand
	) {
		const weightedCalls: WeightedCall[] = [];

		for ( const cardSet of cardSetsInGame ) {
			const cardsOfSet = shuffle( cardSetMap[ cardSet ].map( PlayingCard.from ) );
			const [ canCardSetBeCalled, cardPossibilityMap ] =
				this.canCardSetBeCalled( game, players, cardCounts, cardSet, cardLocations, hand );

			if ( !canCardSetBeCalled ) {
				this.logger.info( format( "This card set is not with my team. Cannot Call! CardSet: %s", cardSet ) );
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
					.filter( playerId => cardCounts[ playerId ] > 0 );

				const randIdx = Math.floor( Math.random() * callablePlayersForCard.length );
				callData[ card.id ] = callablePlayersForCard[ randIdx ];
			}

			weightedCalls.push( { callData, weight, cardSet } );
		}

		this.logger.debug( format( "Weighted Calls: %o", weightedCalls ) );
		return weightedCalls.toSorted( ( a, b ) => b.weight - a.weight );
	}

	suggestAsks(
		game: Game,
		players: PlayerData,
		cardCounts: CardCounts,
		cardSets: CardSet[],
		cardLocations: CardLocation[],
		hand: CardHand
	) {
		const teamId = players[ game.currentTurn ].teamId;
		const oppositeTeamMembers = Object.values( players )
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
					.filter( playerId => cardCounts[ playerId ] > 0 )
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