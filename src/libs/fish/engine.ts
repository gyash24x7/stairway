import { CARD_RANKS, SORTED_DECK } from "@/libs/cards/constants";
import type { CardId } from "@/libs/cards/types";
import { generateDeck, generateHands, getCardDisplayString, getCardFromId, getCardId } from "@/libs/cards/utils";
import { CANADIAN_FISH_BOOKS, GAME_STATUS, NORMAL_FISH_BOOKS } from "@/libs/fish/constants";
import type {
	AskEventInput,
	BasePlayerInfo,
	CanadianFishBook,
	ClaimEventInput,
	CreateTeamsInput,
	FishBookType,
	FishGameConfig,
	FishGameData,
	NormalFishBook,
	PlayerId,
	StartGameInput,
	TransferEventInput
} from "@/libs/fish/types";
import { getBookForCard } from "@/libs/fish/utils";
import { remove } from "@/shared/utils/array";
import { generateAvatar, generateGameCode, generateId, generateName } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { produce } from "immer";
import { format } from "node:util";

const logger = createLogger( "Fish:Engine" );

export function createGame( config: FishGameConfig, creator: PlayerId ): FishGameData {
	return {
		id: generateId(),
		code: generateGameCode(),
		status: GAME_STATUS.CREATED,
		currentTurn: creator,
		config,

		playerIds: [],
		players: {},

		teamIds: [],
		teams: {},

		hands: {},
		cardCounts: {},
		cardMappings: getDefaultCardMappings(),
		bookStates: getDefaultBookStates( config.type ),

		askHistory: [],
		claimHistory: [],
		transferHistory: [],
		metrics: {}
	};
}

/**
 * Generates default card mappings for the game.
 * @returns {Record<CardId, PlayerId>} - The default card mappings object.
 */
function getDefaultCardMappings(): Record<CardId, PlayerId> {
	return SORTED_DECK.reduce(
		( acc, card ) => {
			const cardId = getCardId( card );
			acc[ cardId ] = "";
			return acc;
		},
		{} as Record<CardId, PlayerId>
	);
}

/**
 * Generates default book state data for the game.
 * @param {FishBookType} bookType - The type of fish book (NORMAL or CANADIAN).
 * @param {PlayerId[]} playerIds - Optional array of player IDs to initialize possible owners.
 * @returns {FishGameData["bookStates"]} - The default book state data.
 */
function getDefaultBookStates( bookType: FishBookType, playerIds: PlayerId[] = [] ): FishGameData["bookStates"] {
	const { knownOwners, possibleOwners, inferredOwners } = SORTED_DECK.reduce(
		( acc, card ) => {
			const cardId = getCardId( card );
			acc.knownOwners[ cardId ] = "";
			acc.possibleOwners[ cardId ] = playerIds;
			acc.inferredOwners[ cardId ] = "";
			return acc;
		},
		{} as {
			knownOwners: Record<CardId, PlayerId>,
			possibleOwners: Record<CardId, PlayerId[]>,
			inferredOwners: Record<CardId, PlayerId>
		}
	);

	if ( bookType === "NORMAL" ) {
		return Object.keys( NORMAL_FISH_BOOKS ).map( k => k as NormalFishBook ).reduce(
			( acc, book ) => {
				acc[ book ] = {
					cards: NORMAL_FISH_BOOKS[ book ],
					knownOwners,
					possibleOwners,
					inferredOwners,
					knownCounts: {}
				};
				return acc;
			},
			{} as FishGameData["bookStates"]
		);
	} else {
		return Object.keys( CANADIAN_FISH_BOOKS ).map( k => k as CanadianFishBook ).reduce(
			( acc, book ) => {
				acc[ book ] = {
					cards: CANADIAN_FISH_BOOKS[ book ],
					knownOwners,
					possibleOwners,
					inferredOwners,
					knownCounts: {}
				};
				return acc;
			},
			{} as FishGameData["bookStates"]
		);
	}
}

export function addPlayer( playerInfo: BasePlayerInfo, data: FishGameData ): FishGameData {
	return produce( data, draft => {
		logger.debug( ">> addPlayer()" );

		draft.playerIds.push( playerInfo.id );
		draft.players[ playerInfo.id ] = {
			...playerInfo,
			teamId: "",
			teamMates: [],
			opponents: [],
			isBot: false
		};

		draft.metrics[ playerInfo.id ] = {
			totalAsks: 0,
			cardsTaken: 0,
			cardsGiven: 0,
			totalClaims: 0,
			successfulClaims: 0
		};

		if ( draft.playerIds.length === draft.config.playerCount ) {
			draft.status = GAME_STATUS.PLAYERS_READY;
		}

		logger.debug( "<< addPlayer()" );
	} );
}

export function addBots( data: FishGameData ) {
	return produce( data, draft => {
		logger.debug( ">> addBots()" );

		const botsToAdd = draft.config.playerCount - draft.playerIds.length;
		for ( let i = 0; i < botsToAdd; i++ ) {
			const botId = generateId();
			draft.playerIds.push( botId );
			draft.players[ botId ] = {
				id: botId,
				name: generateName(),
				avatar: generateAvatar(),
				teamId: "",
				teamMates: [],
				opponents: [],
				isBot: true
			};
		}

		draft.status = GAME_STATUS.PLAYERS_READY;
		logger.debug( "<< addBots()" );
	} );
}

export function createTeams( input: CreateTeamsInput, data: FishGameData ) {
	return produce( data, draft => {
		logger.debug( ">> createTeams()" );

		Object.entries( input.data ).forEach( ( [ name, players ] ) => {
			const id = generateId();
			draft.teamIds.push( id );
			draft.teams[ id ] = { id, name, players, score: 0, booksWon: [] };
			players.forEach( playerId => {
				draft.players[ playerId ].teamId = id;
				const teamMates = remove( p => p !== playerId, players );
				draft.players[ playerId ].teamMates = teamMates;
				draft.players[ playerId ].opponents = draft.playerIds.filter( p => !teamMates.includes( p ) );
			} );
		} );

		draft.status = GAME_STATUS.TEAMS_CREATED;
		logger.debug( "<< createTeams()" );
	} );
}

export function startGame( { deckType, type }: StartGameInput, data: FishGameData ) {
	return produce( data, draft => {
		logger.debug( ">> startGame()" );
		draft.config.deckType = deckType;
		draft.config.type = type;
		draft.config.books = draft.config.type === "NORMAL"
			? Object.keys( NORMAL_FISH_BOOKS ).map( k => k as NormalFishBook )
			: Object.keys( CANADIAN_FISH_BOOKS ).map( k => k as CanadianFishBook );

		let deck = generateDeck();
		if ( draft.config.deckType === 48 ) {
			deck = remove( ( { rank } ) => rank === CARD_RANKS.SEVEN, deck );
		}

		const hands = generateHands( deck, draft.config.playerCount );
		draft.playerIds.forEach( ( playerId, idx ) => {
			draft.hands[ playerId ] = hands[ idx ];
			draft.cardCounts[ playerId ] = hands[ idx ].length;
			hands[ idx ].forEach( card => {
				const cardId = getCardId( card );
				draft.cardMappings[ cardId ] = playerId;
			} );
		} );

		draft.bookStates = getDefaultBookStates( draft.config.type, draft.playerIds );
		draft.status = GAME_STATUS.IN_PROGRESS;
		logger.debug( "<< startGame()" );
	} );
}

export function handleAskEvent( event: AskEventInput, data: FishGameData ) {
	return produce( data, draft => {
		logger.debug( ">> handleAskEvent()" );

		const playerId = data.currentTurn;
		const askedCard = getCardFromId( event.cardId );
		const askedBook = getBookForCard( event.cardId, draft.config.type );
		const success = event.askedFrom === draft.cardMappings[ event.cardId ];
		const receivedString = success ? "got the card!" : "was declined!";
		const cardDisplayString = getCardDisplayString( event.cardId );
		const description = format(
			"%s asked %s for %s and %s",
			draft.players[ playerId ].name,
			draft.players[ event.askedFrom ].name,
			cardDisplayString,
			receivedString
		);

		const ask = { id: generateId(), success, description, ...event, timestamp: Date.now(), playerId };
		draft.askHistory.unshift( ask );
		draft.lastMoveType = "ask";

		const nextTurn = !ask.success ? ask.askedFrom : ask.playerId;
		if ( nextTurn !== draft.currentTurn ) {
			draft.currentTurn = nextTurn;
		}

		if ( success ) {
			draft.cardMappings[ ask.cardId ] = ask.playerId;
			draft.hands[ ask.playerId ].push( askedCard );
			draft.hands[ ask.askedFrom ] =
				remove( card => getCardId( card ) === ask.cardId, draft.hands[ ask.askedFrom ] );
			draft.cardCounts[ ask.playerId ]++;
			draft.cardCounts[ ask.askedFrom ]--;

			draft.bookStates[ askedBook ].knownOwners[ ask.cardId ] = ask.playerId;
			draft.bookStates[ askedBook ].possibleOwners[ ask.cardId ] = [];
		} else {
			draft.bookStates[ askedBook ].possibleOwners[ ask.cardId ] = remove(
				( playerId ) => playerId === ask.askedFrom || playerId === ask.playerId,
				draft.bookStates[ askedBook ].possibleOwners[ ask.cardId ]
			);

			const possibleOwners = draft.bookStates[ askedBook ].possibleOwners[ ask.cardId ];
			if ( possibleOwners.length === 1 ) {
				draft.bookStates[ askedBook ].knownOwners[ ask.cardId ] = possibleOwners[ 0 ];
				draft.bookStates[ askedBook ].possibleOwners[ ask.cardId ] = [];
			}
		}

		draft.metrics[ ask.playerId ].totalAsks++;
		draft.metrics[ ask.playerId ].cardsTaken += success ? 1 : 0;
		draft.metrics[ ask.askedFrom ].cardsGiven += success ? 0 : 1;

		logger.debug( "<< handleAskEvent()" );
	} );
}

export function handleClaimEvent( event: ClaimEventInput, data: FishGameData ) {
	return produce( data, draft => {
		logger.debug( ">> handleClaimEvent()" );

		const playerId = data.currentTurn;
		const calledCards = Object.keys( event.claim ).map( cardId => cardId as CardId );
		const [ calledBook ] = calledCards.map( cardId => getBookForCard( cardId, draft.config.type ) );
		const correctClaim = calledCards.reduce(
			( acc, cardId ) => {
				acc[ cardId ] = draft.cardMappings[ cardId ];
				return acc;
			},
			{} as Record<CardId, string>
		);

		let success = true;
		let successString = "correctly!";

		for ( const cardId of calledCards ) {
			if ( correctClaim[ cardId ] !== event.claim[ cardId ] ) {
				success = false;
				successString = "incorrectly!";
				break;
			}
		}

		const description = format(
			"%s declared %s %s",
			draft.players[ playerId ].name,
			calledBook,
			successString
		);

		const claim = {
			id: generateId(),
			success,
			description,
			playerId,
			book: calledBook,
			correctClaim,
			actualClaim: event.claim,
			timestamp: Date.now()
		};

		draft.claimHistory.unshift( claim );

		calledCards.map( cardId => {
			delete draft.cardMappings[ cardId ];
			delete draft.bookStates[ calledBook ];

			const hand = draft.hands[ correctClaim[ cardId ] ];
			draft.hands[ correctClaim[ cardId ] ] = remove( card => getCardId( card ) === cardId, hand );
		} );

		let winningTeamId = draft.players[ playerId ].teamId;

		if ( !success ) {
			[ winningTeamId ] = draft.teamIds.filter( teamId => teamId !== winningTeamId );
		}

		draft.teams[ winningTeamId ].score++;
		draft.teams[ winningTeamId ].booksWon.push( calledBook );

		const booksCompleted = [ calledBook ];
		Object.values( draft.teams ).forEach( team => {
			booksCompleted.push( ...team.booksWon );
		} );

		logger.debug( "BooksCompleted: %o", booksCompleted );
		if ( booksCompleted.length === 8 ) {
			draft.status = GAME_STATUS.COMPLETED;
			return;
		}

		const opponentsWithCards = draft.players[ playerId ].opponents
			.filter( opponentId => !!draft.cardCounts[ opponentId ] );

		draft.currentTurn = !success ? opponentsWithCards[ 0 ] : playerId;
		draft.lastMoveType = "claim";

		draft.metrics[ playerId ].totalClaims++;
		draft.metrics[ playerId ].successfulClaims += success ? 1 : 0;

		logger.debug( "<< handleClaimEvent()" );
	} );
}

export function transferTurn( event: TransferEventInput, data: FishGameData ) {
	return produce( data, draft => {
		logger.debug( ">> transferTurn()" );

		const transferringPlayer = draft.players[ draft.currentTurn ];
		const receivingPlayer = draft.players[ event.transferTo ];

		const transfer = {
			id: generateId(),
			playerId: transferringPlayer.id,
			description: `${ transferringPlayer.name } transferred the turn to ${ receivingPlayer.name }`,
			transferTo: event.transferTo,
			timestamp: Date.now()
		};

		draft.currentTurn = event.transferTo;
		draft.lastMoveType = "transfer";
		draft.transferHistory.unshift( transfer );

		logger.debug( "<< transferTurn()" );
	} );
}
