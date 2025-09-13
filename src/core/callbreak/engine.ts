import type {
	CreateGameInput,
	DealWithRounds,
	DeclareDealWinsInput,
	GameData,
	HandData,
	PlayCardInput,
	PlayerId,
	Round
} from "@/core/callbreak/schema";
import { getBestCardPlayed } from "@/core/callbreak/utils";
import { generateDeck, generateHands, getCardFromId, getCardId, getCardSuit } from "@/core/cards/utils";
import { remove } from "@/utils/fns";
import { generateBotInfo, generateGameCode, generateId } from "@/utils/generator";
import { createLogger } from "@/utils/logger";
import type { AuthInfo } from "@/workers/auth/schema";
import { produce } from "immer";

const logger = createLogger( "Callbreak:Engine" );

/**
 * Creates a new game with the specified parameters.
 * method initializes the game data with the provided deal count and trump suit,
 * and sets the initial state of the game.
 *
 * @param {CreateGameInput} input The input containing deal count and trump suit.
 * @param {PlayerId} playerId The ID of the player creating the game.
 * @return {GameData} The initialized game data with the new game and player information.
 */
function createGame( { dealCount = 5, trumpSuit, gameId }: CreateGameInput, playerId: PlayerId ): GameData {
	logger.debug( ">> createGame()" );
	const data: GameData = {
		id: gameId ?? generateId(),
		code: generateGameCode(),
		dealCount,
		trump: trumpSuit,
		currentTurn: playerId,
		status: "GAME_CREATED",
		scores: {},
		createdBy: playerId,
		players: {},
		deals: []
	};

	logger.debug( "<< createGame()" );
	return data;
}

/**
 * Adds the player to the game data.
 * method is called after successful validation of the join game request.
 * It updates the players in the game data with the authenticated user's information.
 *
 * @param {GameData} data The current game data.
 * @param {BasePlayerInfo} playerInfo The authenticated user's information.
 * @return {GameData} The updated game data with the new player added.
 */
function addPlayer( data: GameData, playerInfo: AuthInfo ): GameData {
	return produce( data, draft => {
		logger.debug( ">> addPlayer()" );
		draft.players[ playerInfo.id ] = { ...playerInfo, isBot: false };
		draft.scores[ playerInfo.id ] = [];

		if ( Object.keys( draft.players ).length === 4 ) {
			draft.status = "PLAYERS_READY";
		}

		logger.debug( "<< addPlayer()" );
	} );
}

/**
 * Adds bots to the game data.
 * method is called when the game has less than 4 players.
 * It generates bot player information and adds them to the game data.
 *
 * @param {GameData} data The current game data.
 * @return {GameData} The updated game data with bots added.
 */
function addBots( data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> addBots()" );

		const botCount = 4 - Object.keys( draft.players ).length;
		for ( let i = 0; i < botCount; i++ ) {
			const botInfo = generateBotInfo();
			draft.players[ botInfo.id ] = { ...botInfo, isBot: true };
			draft.scores[ botInfo.id ] = [];
		}

		draft.status = "PLAYERS_READY";
		logger.debug( "<< addBots()" );
	} );
}

/**
 * Creates a new deal in the game.
 * method generates a deck of cards, shuffles it, and deals hands to the players.
 * It also sets the player order based on the current game state.
 *
 * @param {GameData} data The current game data.
 * @return {GameData} The updated game data with the new deal created.
 */
function createDeal( data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> createDeal()" );

		const deck = generateDeck();
		const hands = generateHands( deck, 4 );
		const playerIds = Object.keys( draft.players ).toSorted();
		const playerOrder = draft.deals.length === 0 ?
			[
				...playerIds.slice( playerIds.indexOf( draft.createdBy ) ),
				...playerIds.slice( 0, playerIds.indexOf( draft.createdBy ) )
			] :
			[ ...draft.deals[ 0 ].playerOrder.slice( 1 ), draft.deals[ 0 ].playerOrder[ 0 ] ];

		const deal: DealWithRounds = {
			id: generateId(),
			playerOrder,
			status: "CREATED",
			declarations: {},
			wins: {},
			createdAt: Date.now(),
			rounds: [],
			hands: hands.reduce(
				( acc, value, index ) => {
					acc[ playerOrder[ index ] ] = value;
					return acc;
				},
				{} as HandData
			)
		};

		draft.deals.unshift( deal );
		draft.status = "CARDS_DEALT";
		draft.currentTurn = deal.playerOrder[ 0 ];

		logger.debug( "<< createDeal()" );
	} );
}

/**
 * Declares the number of wins for the current deal.
 * method updates the current deal's declarations with the player's input.
 * It also updates the current turn to the next player in the order.
 *
 * @param {DeclareDealWinsInput} input The input containing the number of wins declared by the player.
 * @param {GameData} data The current game data.
 * @returns {GameData} The updated game data with the declared wins.
 */
function declareDealWins( input: DeclareDealWinsInput, data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> declareDealWins()" );

		if ( Object.keys( draft.deals[ 0 ].declarations ).length === 0 ) {
			draft.deals[ 0 ].status = "IN_PROGRESS";
		}

		const nextPlayerIdx = ( draft.deals[ 0 ].playerOrder.indexOf( draft.currentTurn ) + 1 ) % 4;
		draft.deals[ 0 ].declarations[ draft.currentTurn ] = input.wins;
		draft.currentTurn = draft.deals[ 0 ].playerOrder[ nextPlayerIdx ];

		if ( Object.keys( draft.deals[ 0 ].declarations ).length === 4 ) {
			draft.status = "WINS_DECLARED";
		}

		logger.debug( "<< declareDealWins()" );
	} );
}

/**
 * Creates a new round in the current deal.
 * method initializes a new round with the player order based on the winner of the last round.
 * It also sets the current turn to the first player in the order.
 *
 * @param {GameData} data The current game data containing the active deal.
 * @returns {GameData} The updated game data with the new round created.
 */
function createRound( data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> createRound()" );

		const activeDeal = draft.deals[ 0 ];
		const lastRound = activeDeal.rounds[ 0 ];
		const playerOrder = !lastRound ? activeDeal.playerOrder : [
			...lastRound.playerOrder.slice( lastRound.playerOrder.indexOf( lastRound.winner! ) ),
			...lastRound.playerOrder.slice( 0, lastRound.playerOrder.indexOf( lastRound.winner! ) )
		];

		const round: Round = {
			id: generateId(),
			playerOrder,
			status: "CREATED",
			cards: {},
			createdAt: Date.now()
		};

		activeDeal.rounds.unshift( round );
		draft.deals[ 0 ] = activeDeal;
		draft.currentTurn = playerOrder[ 0 ];
		draft.status = "ROUND_STARTED";

		logger.debug( "<< createRound()" );
	} );
}

/**
 * Plays a card in the current round.
 * method updates the round's cards with the player's played card,
 * sets the suit if it's the first card played,
 * and updates the player's hand by removing the played card.
 * It also updates the current turn to the next player in the order.
 *
 * @param {PlayCardInput} input The input containing the card ID, round ID, deal ID, and authInfo.
 * @param {GameData} data The current game data containing the active deal and round.
 * @returns {GameData} The updated game data with the played card and updated turn.
 */
function playCard( input: PlayCardInput, data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> playCard()" );

		const activeDeal = draft.deals[ 0 ];
		const activeRound = activeDeal.rounds[ 0 ];
		const playerInfo = draft.players[ draft.currentTurn ];

		activeRound.cards[ playerInfo.id ] = input.cardId;
		if ( !activeRound.suit ) {
			activeRound.status = "IN_PROGRESS";
			activeRound.suit = getCardSuit( input.cardId );
		}

		activeDeal.rounds[ 0 ] = activeRound;
		activeDeal.hands[ playerInfo.id ] = remove(
			card => getCardId( card ) === input.cardId,
			activeDeal.hands[ playerInfo.id ]
		);

		if ( Object.keys( activeRound.cards ).length === 4 ) {
			draft.status = "CARDS_PLAYED";
		}

		const nextPlayerIdx = ( activeRound.playerOrder.indexOf( draft.currentTurn ) + 1 ) % 4;
		draft.currentTurn = activeRound.playerOrder[ nextPlayerIdx ];
		draft.deals[ 0 ] = activeDeal;

		logger.debug( "<< playCard()" );
	} );
}

/**
 * Completes the current round by determining the winning card.
 * method finds the best card played in the round,
 * updates the round's status to completed,
 * and records the winner.
 *
 * @param {GameData} data The current game data containing the active deal and round.
 * @returns {GameData} The updated game data with the completed round and winner recorded.
 */
function completeRound( data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> completeRound()" );

		const activeDeal = draft.deals[ 0 ];
		const activeRound = activeDeal.rounds[ 0 ];

		const winningCard = getBestCardPlayed(
			Object.values( activeRound.cards ).map( getCardFromId ),
			draft.trump,
			activeRound.suit
		);

		logger.info( "Winning Card: %s", winningCard );

		const winningPlayer = activeRound.playerOrder.find( p => activeRound.cards[ p ] === getCardId( winningCard! ) );
		logger.info( "Player %s won the round", winningPlayer );

		activeRound.status = "COMPLETED";
		activeRound.winner = winningPlayer;
		activeDeal.wins[ winningPlayer! ] = ( activeDeal.wins[ winningPlayer! ] || 0 ) + 1;

		activeDeal.rounds[ 0 ] = activeRound;
		draft.deals[ 0 ] = activeDeal;
		draft.status = "ROUND_COMPLETED";

		logger.debug( "<< completeRound()" );
	} );
}

/**
 * Completes the current deal by calculating scores for each player.
 * method iterates through the players' declarations and wins,
 * calculates the score based on the rules,
 * and updates the game scores accordingly.
 * It also marks the deal as completed.
 *
 * @param {GameData} data The current game data containing the active deal.
 * @returns {GameData} The updated game data with the completed deal and scores calculated.
 */
function completeDeal( data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> completeDeal()" );

		const activeDeal = draft.deals[ 0 ];
		Object.keys( draft.players ).forEach( playerId => {
			const declared = activeDeal.declarations[ playerId ];
			const won = activeDeal.wins[ playerId ] ?? 0;
			const score = declared > won ? ( -10 * declared ) : ( 10 * declared ) + ( 2 * ( won - declared ) );
			draft.scores[ playerId ].push( score );
		} );

		activeDeal.status = "COMPLETED";
		draft.deals[ 0 ] = activeDeal;
		draft.status = "DEAL_COMPLETED";

		logger.debug( "<< completeDeal()" );
	} );
}

export const engine = {
	createGame,
	addPlayer,
	addBots,
	createDeal,
	declareDealWins,
	createRound,
	playCard,
	completeRound,
	completeDeal
};