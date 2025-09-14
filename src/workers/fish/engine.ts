import { remove } from "@/utils/array";
import type { CardId } from "@/utils/cards";
import {
	CARD_RANKS,
	generateDeck,
	generateHands,
	getCardDisplayString,
	getCardId,
	isCardInHand,
	SORTED_DECK
} from "@/utils/cards";
import { generateAvatar, generateGameCode, generateId, generateName } from "@/utils/generator";
import { createLogger } from "@/utils/logger";
import type { AuthInfo } from "@/workers/auth/types";
import type {
	AskEventInput,
	BookType,
	CanadianBook,
	ClaimEventInput,
	CreateTeamsInput,
	GameConfig,
	GameData,
	NormalBook,
	PlayerGameInfo,
	PlayerId,
	StartGameInput,
	TeamCount,
	TransferEventInput,
	WeightedAsk,
	WeightedBook,
	WeightedClaim,
	WeightedTransfer
} from "@/workers/fish/types";
import {
	CANADIAN_BOOKS,
	GAME_STATUS,
	getBookForCard,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	NORMAL_BOOKS
} from "@/workers/fish/utils";
import { produce } from "immer";
import { format } from "node:util";

const logger = createLogger( "Fish:Engine" );

/**
 * Creates a new Fish game instance with the provided configuration and creator.
 * @param {GameConfig} config - The configuration for the game, including gameIdInputSchema
 * @param {PlayerId} creator - The ID of the player creating the game.
 * @returns {GameData} - The newly created game data object.
 */
function createGame( config: GameConfig, creator: PlayerId ): GameData {
	logger.debug( ">> createGame()" );
	const game = {
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

	logger.debug( "<< createGame()" );
	return game;
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
 * @param {BookType} bookType - The type of core book (NORMAL or CANADIAN).
 * @param {PlayerId[]} playerIds - Optional array of player IDs to initialize possible owners.
 * @returns {GameData["bookStates"]} - The default book state data.
 */
function getDefaultBookStates( bookType: BookType, playerIds: PlayerId[] = [] ): GameData["bookStates"] {
	const { knownOwners, possibleOwners, inferredOwners } = SORTED_DECK.reduce(
		( acc, card ) => {
			const cardId = getCardId( card );
			acc.knownOwners[ cardId ] = "";
			acc.possibleOwners[ cardId ] = playerIds;
			acc.inferredOwners[ cardId ] = "";
			return acc;
		},
		{
			knownOwners: {} as Record<CardId, PlayerId>,
			possibleOwners: {} as Record<CardId, PlayerId[]>,
			inferredOwners: {} as Record<CardId, PlayerId>
		}
	);

	if ( bookType === "NORMAL" ) {
		return Object.keys( NORMAL_BOOKS ).map( k => k as NormalBook ).reduce(
			( acc, book ) => {
				acc[ book ] = {
					cards: NORMAL_BOOKS[ book ],
					knownOwners,
					possibleOwners,
					inferredOwners,
					knownCounts: {}
				};
				return acc;
			},
			{} as GameData["bookStates"]
		);
	} else {
		return Object.keys( CANADIAN_BOOKS ).map( k => k as CanadianBook ).reduce(
			( acc, book ) => {
				acc[ book ] = {
					cards: CANADIAN_BOOKS[ book ],
					knownOwners,
					possibleOwners,
					inferredOwners,
					knownCounts: {}
				};
				return acc;
			},
			{} as GameData["bookStates"]
		);
	}
}

/**
 * Adds a player to the Fish game data.
 * @param {GameData} data - The current game data.
 * @param {AuthInfo} playerInfo - The information of the player to be added.
 * @returns {GameData} - The updated game data with the new player added.
 */
function addPlayer( data: GameData, playerInfo: AuthInfo ): GameData {
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

/**
 * Adds bot players to the Fish game data based on the configured player count.
 * @param {GameData} data - The current game data.
 * @returns {GameData} - The updated game data with bots added.
 */
function addBots( data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> addBots()" );

		const botsToAdd = draft.config.playerCount - draft.playerIds.length;
		for ( let i = 0; i < botsToAdd; i++ ) {
			const botId = generateId();
			draft.playerIds.push( botId );
			draft.players[ botId ] = {
				id: botId,
				name: generateName(),
				username: generateName(),
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

/**
 * Creates teams in the Fish game based on the provided input.
 * @param {CreateTeamsInput} input - The input containing team data.
 * @param {GameData} data - The current game data.
 * @returns {GameData} - The updated game data with teams created.
 */
function createTeams( input: CreateTeamsInput, data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> createTeams()" );

		data.config.teamCount = Object.keys( input.data ).length as TeamCount;
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

/**
 * Starts the Fish game with the provided configuration and initializes player hands.
 * @param {StartGameInput} input - The input containing deck type and game type.
 * @param {GameData} data - The current game data.
 * @returns {GameData} - The updated game data with the game started.
 */
function startGame( { deckType, type }: StartGameInput, data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> startGame()" );
		draft.config.deckType = deckType;
		draft.config.type = type;
		draft.config.books = draft.config.type === "NORMAL"
			? Object.keys( NORMAL_BOOKS ).map( k => k as NormalBook )
			: Object.keys( CANADIAN_BOOKS ).map( k => k as CanadianBook );

		let deck = generateDeck();
		if ( draft.config.deckType === 48 ) {
			deck = remove( ( { rank } ) => rank === CARD_RANKS.SEVEN, deck );
		}

		const hands = generateHands( deck, draft.config.playerCount );
		draft.playerIds.forEach( ( playerId, idx ) => {
			draft.hands[ playerId ] = hands[ idx ].map( getCardId );
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

/**
 * Handles an ask event in the Fish game.
 * @param {AskEventInput} event - The ask event input containing the player ID and card ID.
 * @param {GameData} data - The current game data.
 * @returns {GameData} - The updated game data with the ask processed.
 */
function handleAskEvent( event: AskEventInput, data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> handleAskEvent()" );

		const playerId = data.currentTurn;
		const askedBook = getBookForCard( event.cardId, draft.config.type );
		const success = event.from === draft.cardMappings[ event.cardId ];
		const receivedString = success ? "got the card!" : "was declined!";
		const cardDisplayString = getCardDisplayString( event.cardId );
		const description = format(
			"%s asked %s for %s and %s",
			draft.players[ playerId ].name,
			draft.players[ event.from ].name,
			cardDisplayString,
			receivedString
		);

		if ( !draft.bookStates[ askedBook ] ) {
			draft.bookStates[ askedBook ] = {
				cards: getCardsOfBook( askedBook, draft.config.type ).map( getCardId ),
				knownOwners: {},
				possibleOwners: {},
				inferredOwners: {},
				knownCounts: {}
			};
		}

		const ask = { id: generateId(), success, description, ...event, timestamp: Date.now(), playerId };
		draft.askHistory.unshift( ask );
		draft.lastMoveType = "ask";

		const nextTurn = !ask.success ? ask.from : ask.playerId;
		if ( nextTurn !== draft.currentTurn ) {
			draft.currentTurn = nextTurn;
		}

		if ( success ) {
			draft.cardMappings[ ask.cardId ] = ask.playerId;
			draft.hands[ ask.playerId ].push( event.cardId );
			draft.hands[ ask.from ] = remove( card => card === ask.cardId, draft.hands[ ask.from ] );
			draft.cardCounts[ ask.playerId ]++;
			draft.cardCounts[ ask.from ]--;

			draft.bookStates[ askedBook ].knownOwners[ ask.cardId ] = ask.playerId;
			draft.bookStates[ askedBook ].possibleOwners[ ask.cardId ] = [];
		} else {
			draft.bookStates[ askedBook ].possibleOwners[ ask.cardId ] = remove(
				( playerId ) => playerId === ask.from || playerId === ask.playerId,
				draft.bookStates[ askedBook ].possibleOwners[ ask.cardId ] ?? []
			);

			const possibleOwners = draft.bookStates[ askedBook ].possibleOwners[ ask.cardId ] ?? [];
			if ( possibleOwners.length === 1 ) {
				draft.bookStates[ askedBook ].knownOwners[ ask.cardId ] = possibleOwners[ 0 ];
				draft.bookStates[ askedBook ].possibleOwners[ ask.cardId ] = [];
			}
		}

		draft.metrics[ ask.playerId ].totalAsks++;
		draft.metrics[ ask.playerId ].cardsTaken += success ? 1 : 0;
		draft.metrics[ ask.from ].cardsGiven += success ? 0 : 1;

		logger.debug( "<< handleAskEvent()" );
	} );
}

/**
 * Handles a claim event in the Fish game.
 * @param {ClaimEventInput} event - The claim event input containing the claimed cards.
 * @param {GameData} data - The current game data.
 * @returns {GameData} - The updated game data with the claim processed.
 */
function handleClaimEvent( event: ClaimEventInput, data: GameData ): GameData {
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
			{} as Partial<Record<CardId, string>>
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

			const hand = draft.hands[ correctClaim[ cardId ]! ];
			draft.hands[ correctClaim[ cardId ]! ] = remove( card => card === cardId, hand );
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

/**
 * Handles a turn transfer event in the Fish game.
 * @param {TransferEventInput} event - The transfer event input containing the player ID to transfer the turn to.
 * @param {GameData} data - The current game data.
 * @returns {GameData} - The updated game data with the turn transferred.
 */
function handleTransferEvent( event: TransferEventInput, data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> handleTransferEvent()" );

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

		logger.debug( "<< handleTransferEvent()" );
	} );
}

const MAX_WEIGHT = 720;

/**
 * Suggests books that the player can ask from or claim based on their hand and the current game state.
 * The books are weighted based on how likely they are to be completed.
 * The weight is calculated for each card and averaged for a book. It is calculated as follows:
 * - If the player has the card in hand, the weight is MAX_WEIGHT.
 * - If the card's owner is known, the weight is MAX_WEIGHT.
 * - If the card's owner is inferred, the weight is MAX_WEIGHT / 2.
 * - If the card's owner is neither known nor inferred, the weight is MAX_WEIGHT / number of possible owners.
 *
 * @param {PlayerGameInfo} playerGameInfo - The game information for the player
 * @returns {WeightedBook[]} - An array of weighted books that the player can ask from or claim.
 */
function suggestBooks( { playerId, hand, players, bookStates, config }: PlayerGameInfo ): WeightedBook[] {
	logger.debug( ">> suggestBooks()" );

	const validBooks = config.books.filter( book => !!bookStates[ book ] );
	const currentPlayer = players[ playerId ];
	const weightedBooks: WeightedBook[] = [];

	for ( const book of validBooks ) {

		const weightedBook = { book, weight: 0, isBookWithTeam: true, isClaimable: true, isKnown: true };
		const state = bookStates[ book ];
		if ( !state ) {
			continue;
		}

		for ( const cardId of state.cards ) {

			if ( isCardInHand( hand, cardId ) ) {
				weightedBook.weight += MAX_WEIGHT;
				continue;
			}

			if ( state.knownOwners[ cardId ] ) {
				weightedBook.weight += MAX_WEIGHT;
				if ( !currentPlayer.teamMates.includes( state.knownOwners[ cardId ] ) ) {
					weightedBook.isBookWithTeam = false;
					weightedBook.isClaimable = false;
				}
				continue;
			}

			if ( state.inferredOwners[ cardId ] ) {
				weightedBook.weight += MAX_WEIGHT / 2;
				if ( !currentPlayer.teamMates.includes( state.inferredOwners[ cardId ] ) ) {
					weightedBook.isBookWithTeam = false;
					weightedBook.isClaimable = false;
				}
				continue;
			}

			if ( state.possibleOwners[ cardId ] && state.possibleOwners[ cardId ].length > 0 ) {
				weightedBook.isKnown = false;
				weightedBook.isClaimable = false;
				weightedBook.weight += MAX_WEIGHT / state.possibleOwners[ cardId ].length;

				if ( !state.possibleOwners[ cardId ].every( pid => currentPlayer.teamMates.includes( pid ) ) ) {
					weightedBook.isBookWithTeam = false;
				}
			}

			if ( !getBooksInHand( hand, config.type ).includes( book ) ) {
				weightedBook.isClaimable = false;
			}
		}

		weightedBooks.push( { ...weightedBook, weight: weightedBook.weight / state.cards.length } );
	}

	logger.debug( "<< suggestBooks()" );
	return weightedBooks.toSorted( ( a, b ) => b.weight - a.weight );
}

/**
 * Suggests asks for cards based on the player's hand and the current game state.
 * The asks are weighted based on the likelihood of getting the card from the specified player.
 * The weight is calculated as follows:
 * - If the card's owner is known, the weight is MAX_WEIGHT.
 * - If the card's owner is inferred, the weight is MAX_WEIGHT / 2.
 * - If the card's owner is neither known nor inferred, the weight is MAX_WEIGHT / number of possible owners.
 *
 * @param {WeightedBook[]} books - The list of books in the game.
 * @param {PlayerGameInfo} data - The game information for the player.
 * @returns {WeightedAsk[]} - An array of weighted asks that the player can make.
 */
function suggestAsks( books: WeightedBook[], data: PlayerGameInfo ): WeightedAsk[] {
	logger.debug( ">> suggestAsks()" );

	const { playerId, hand, players, bookStates, config } = data;
	const currentPlayer = players[ playerId ];
	const weightedAsks: WeightedAsk[] = [];

	for ( const { book } of books ) {
		const missingCards = getMissingCards( hand, book, config.type );
		const asksForBook: WeightedAsk[] = [];
		const state = bookStates[ book ];
		if ( !state ) {
			continue;
		}

		for ( const cardId of missingCards ) {
			const knownOwner = state.knownOwners[ cardId ];
			const possibleOwners = state.possibleOwners[ cardId ] ?? [];

			if ( knownOwner && knownOwner !== playerId && !currentPlayer.teamMates.includes( knownOwner ) ) {
				asksForBook.push( { playerId: knownOwner, cardId, weight: MAX_WEIGHT } );
			} else {
				for ( const pid of possibleOwners ) {
					if ( pid !== playerId && !currentPlayer.teamMates.includes( pid ) ) {
						asksForBook.push( { playerId: pid, cardId, weight: MAX_WEIGHT / possibleOwners.length } );
					}
				}
			}
		}

		weightedAsks.push( ...asksForBook.toSorted( ( a, b ) => b.weight - a.weight ) );
	}

	logger.debug( "<< suggestAsks()" );
	return weightedAsks;
}

/**
 * Suggests claims for books based on the current game state.
 * The claims are weighted based on the completeness of the book and the known/inferred owners of the cards.
 * The weight of a claim is summed up from the weights of the cards in the book:
 * - If the card's owner is known, the weight is MAX_WEIGHT.
 * - If the card's owner is inferred, the weight is MAX_WEIGHT / 2.
 * - If the card's owner is neither known nor inferred, the book is not claimable.
 *
 * @param {WeightedBook[]} books - The list of weighted books in the game.
 * @param {PlayerGameInfo} data - The game information for the player.
 * @return {WeightedClaim[]} - An array of weighted claims that the player can make.
 */
function suggestClaims( books: WeightedBook[], { bookStates }: PlayerGameInfo ): WeightedClaim[] {
	logger.debug( ">> suggestClaims()" );

	const validBooks = books.filter( book => book.isClaimable && book.isBookWithTeam );
	const claims: WeightedClaim[] = [];

	for ( const { book } of validBooks ) {
		const state = bookStates[ book ];
		let weight = 0;
		const claim = {} as Record<CardId, PlayerId>;
		if ( !state ) {
			continue;
		}

		for ( const cardId of state.cards ) {
			if ( state.knownOwners[ cardId ] ) {
				weight += MAX_WEIGHT;
				claim[ cardId ] = state.knownOwners[ cardId ];
			} else if ( state.inferredOwners[ cardId ] ) {
				weight += MAX_WEIGHT / 2;
				claim[ cardId ] = state.inferredOwners[ cardId ];
			}
		}

		if ( Object.keys( claim ).length === state.cards.length ) {
			claims.push( { book, claim, weight } );
		}
	}

	logger.debug( "<< suggestClaims()" );
	return claims.sort( ( a, b ) => b.weight - a.weight );
}

/**
 * Suggests transfers of cards to team members based on the current game state.
 * The transfers are weighted based on the number of cards that can be transferred to teammates.
 * Preference is given to books that are not completely with the team and have maximum information about card ownership.
 * If there are no books which can be snatched, there's no need to transfer turn
 *
 * @param {WeightedBook[]} books - The list of weighted books in the game.
 * @param {PlayerGameInfo} data - The game information for the player.
 * @returns {WeightedTransfer[]} - An array of suggested transfers with weights.
 */
function suggestTransfers( books: WeightedBook[], data: PlayerGameInfo ): WeightedTransfer[] {
	logger.debug( ">> suggestTransfers()" );

	const { playerId, players, bookStates } = data;
	const currentPlayer = players[ playerId ];
	const validBooks = books.filter( book => !book.isBookWithTeam && book.isKnown );
	const weightedTransfers = {} as Record<PlayerId, number>;

	for ( const { book } of validBooks ) {
		const state = bookStates[ book ];
		if ( !state ) {
			continue;
		}

		for ( const cardId of state.cards ) {
			const owner = state.knownOwners[ cardId ] || state.inferredOwners[ cardId ];
			if ( owner && currentPlayer.teamMates.includes( owner ) ) {
				weightedTransfers[ owner ] = ( weightedTransfers[ owner ] ?? 0 ) + MAX_WEIGHT;
			}
		}
	}

	logger.debug( "<< suggestTransfers()" );
	return Object.entries( weightedTransfers )
		.map( ( [ transferTo, weight ] ) => ( { transferTo, weight } ) )
		.toSorted( ( a, b ) => b.weight - a.weight );
}

export const engine = {
	createGame,
	addPlayer,
	addBots,
	createTeams,
	startGame,
	handleAskEvent,
	handleClaimEvent,
	handleTransferEvent,
	suggestAsks,
	suggestBooks,
	suggestClaims,
	suggestTransfers
};