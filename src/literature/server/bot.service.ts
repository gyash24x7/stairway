import { getCardId, getCardSet } from "@/libs/cards/card";
import { cardSetMap } from "@/libs/cards/constants";
import { getAskableCardsOfSet, isCardInHand, isCardSetInHand } from "@/libs/cards/hand";
import type { CardSet, PlayingCard } from "@/libs/cards/types";
import { shuffle } from "@/libs/cards/utils";
import type { Literature } from "@/literature/types";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger( "LiteratureBotService" );

type WeightedAsk = { cardId: string, playerId: string, weight: number }
type WeightedCall = { cardSet: CardSet, callData: Record<string, string>, weight: number }
type WeightedTransfer = { weight: number, transferTo: string };
type WeightedCardSet = { cardSet: CardSet, weight: number };

const MAX_ASK_WEIGHT = 720;

export function suggestCardSets( cardLocations: Literature.CardLocationData, hand: PlayingCard[] ): CardSet[] {
	const weightedCardSets: WeightedCardSet[] = [];
	const cardSetsInGame = new Set( Object.keys( cardLocations ).map( getCardSet ) );

	for ( const cardSet of cardSetsInGame ) {
		let weight = 0;

		for ( const card of cardSetMap[ cardSet ] ) {
			const cardLocation = cardLocations[ getCardId( card ) ];
			if ( !cardLocation || Object.keys( cardLocation ).length === 0 ) {
				continue;
			}

			weight += MAX_ASK_WEIGHT / Object.keys( cardLocation ).length;
		}

		weightedCardSets.push( { cardSet, weight } );
	}

	logger.info( "Weighted CardSets: %o", weightedCardSets.sort( ( a, b ) => b.weight - a.weight ) );

	return weightedCardSets.map( w => w.cardSet ).filter( ( cardSet ) => isCardSetInHand( hand, cardSet ) );
}

export function suggestTransfer( { game, players }: Literature.GameData ): WeightedTransfer[] {
	const teamId = players[ game.currentTurn ].teamId;
	const myTeamMembers = Object.values( players )
		.filter( player => player.teamId === teamId && player.id !== game.currentTurn && player.cardCount > 0 )
		.map( player => player.id );

	const weightedTransfers = myTeamMembers.map( transferTo => {
		return { weight: 720 / myTeamMembers.length + players[ transferTo ].cardCount, transferTo };
	} );

	logger.debug( "Weighted Transfers: %o", weightedTransfers );
	return weightedTransfers.toSorted( ( a, b ) => b.weight - a.weight );
}

export function canCardSetBeCalled( cardSet: CardSet, { game, players, cardLocations }: Literature.GameData ) {
	const currentPlayer = players[ game.currentTurn ];
	const oppositeTeamMembers = Object.values( players )
		.filter( player => player.teamId !== currentPlayer.teamId )
		.map( player => player.id );

	const cardPossibilityMap: Record<string, string[]> = {};
	let isCardSetWithUs = true;

	for ( const card of shuffle( cardSetMap[ cardSet ] ) ) {

		const cardId = getCardId( card );
		if ( isCardInHand( currentPlayer.hand, card ) ) {
			cardPossibilityMap[ cardId ] = [ game.currentTurn ];
			continue;
		}

		if ( !cardLocations[ cardId ] || Object.keys( cardLocations[ cardId ] ).length === 0 ) {
			continue;
		}

		cardPossibilityMap[ cardId ] = Object.keys( cardLocations[ cardId ] );
		Object.keys( cardLocations[ cardId ] )
			.filter( playerId => players[ playerId ].cardCount > 0 )
			.forEach( playerId => {
				if ( oppositeTeamMembers.includes( playerId ) ) {
					isCardSetWithUs = false;
				}
			} );
	}

	const totalCardsCalled = Object.keys( cardPossibilityMap ).length;
	const canCardSetBeCalled = isCardSetWithUs && totalCardsCalled === 6;

	return [ canCardSetBeCalled, cardPossibilityMap ] as const;
}

export function suggestCalls( cardSetsInGame: CardSet[], data: Literature.GameData ) {
	const weightedCalls: WeightedCall[] = [];
	logger.info( "CardSets in Game: %o", cardSetsInGame );

	for ( const cardSet of cardSetsInGame ) {

		const [ canCardSetBeCalledValue, cardPossibilityMap ] = canCardSetBeCalled( cardSet, data );
		if ( !canCardSetBeCalledValue ) {
			logger.info( "This card set is not with my team. Cannot Call! CardSet: %s", cardSet );
			continue;
		}

		const totalPossiblePlayers = Object.values( cardPossibilityMap ).flat().length;
		let weight = MAX_ASK_WEIGHT;

		if ( totalPossiblePlayers > 6 ) {
			weight /= totalPossiblePlayers - 6;
		}

		const callData: Record<string, string> = {};
		for ( const card of shuffle( cardSetMap[ cardSet ] ) ) {
			const cardId = getCardId( card );
			const callablePlayersForCard = cardPossibilityMap[ cardId ]
				.filter( playerId => data.players[ playerId ].cardCount > 0 );

			const randIdx = Math.floor( Math.random() * callablePlayersForCard.length );
			callData[ cardId ] = callablePlayersForCard[ randIdx ];
		}

		weightedCalls.push( { callData, weight, cardSet } );
	}

	logger.debug( "Weighted Calls: %o", weightedCalls );
	return weightedCalls.toSorted( ( a, b ) => b.weight - a.weight );
}

export function suggestAsks( cardSets: CardSet[], { game, players, cardLocations }: Literature.GameData ) {
	const currentPlayer = players[ game.currentTurn ];
	const oppositeTeamMembers = Object.values( players )
		.filter( player => player.teamId !== currentPlayer.teamId )
		.map( player => player.id );

	const weightedAskMap: Record<string, WeightedAsk[]> = {};
	const weightedAsks: WeightedAsk[] = [];

	for ( const cardSet of cardSets ) {
		if ( !isCardSetInHand( currentPlayer.hand, cardSet ) ) {
			continue;
		}

		const cardsOfSet = shuffle( getAskableCardsOfSet( currentPlayer.hand, cardSet ) );
		weightedAskMap[ cardSet ] = [];

		for ( const card of cardsOfSet ) {

			const cardId = getCardId( card );
			if ( !cardLocations[ cardId ] || Object.keys( cardLocations[ cardId ] ).length === 0 ) {
				continue;
			}

			const possibleAsks: WeightedAsk[] = Object.keys( cardLocations[ cardId ] )
				.filter( playerId => oppositeTeamMembers.includes( playerId ) )
				.filter( playerId => players[ playerId ].cardCount > 0 )
				.map( playerId => {
					const weight = MAX_ASK_WEIGHT / Object.keys( cardLocations[ cardId ] ).length;
					return { cardId, playerId, weight };
				} );

			weightedAskMap[ cardSet ].push( ...shuffle( possibleAsks ) );
		}

		weightedAskMap[ cardSet ].sort( ( a, b ) => b.weight - a.weight );
		weightedAsks.push( ...weightedAskMap[ cardSet ] );
	}

	return weightedAsks;
}