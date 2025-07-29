import type { AuthInfo } from "@/auth/types";

import type { Callbreak } from "@/callbreak/types";
import { CARD_RANKS, CARD_SUITS } from "@/libs/cards/constants";
import type { CardRank, CardSuit, PlayingCard } from "@/libs/cards/types";
import {
	canCardBePlayed,
	compareCards,
	generateDeck,
	generateHands,
	getBestCardPlayed,
	getCardFromId,
	getCardId,
	getCardsOfSuit,
	getCardSuit,
	getPlayableCards,
	isCardInHand,
} from "@/libs/cards/utils";
import { remove } from "@/shared/utils/array";
import { generateBotInfo, generateGameCode, generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { DurableObject } from "cloudflare:workers";

export class CallbreakDurableObject extends DurableObject {

	private readonly logger = createLogger( "Callbreak:DO" );

	private readonly state: DurableObjectState;

	constructor( state: DurableObjectState, env: Env ) {
		super( state, env );
		this.state = state;
	}

	async getGameData( gameId: string, playerId?: string ) {
		this.logger.debug( ">> getGameStore()" );

		const data = await this.state.storage.get<Callbreak.GameData>( gameId );
		if ( !data ) {
			this.logger.error( "Game Not Found!" );
			throw "Game Not Found!";
		}

		if ( playerId && !data.players[ playerId ] ) {
			this.logger.error( "Player not part of this game! PlayerId: %s", playerId );
			throw "Player not part of this game!";
		}

		this.logger.debug( "<< getGameStore()" );
		return data;
	}

	async saveGameData( gameId: string, data: Callbreak.GameData ) {
		this.logger.debug( ">> saveGameData()" );
		await this.state.storage.put( gameId, data );
		await this.state.storage.put( `code_${ data.game.code }`, gameId );
		this.logger.debug( "<< saveGameData()" );
		return data;
	}

	async getGameByCode( code: string ) {
		this.logger.debug( ">> getGameByCode()" );

		const gameId = await this.state.storage.get<string>( `code_${ code }` );
		if ( !gameId ) {
			this.logger.error( "Game not found!", code );
			throw "Game not found!";
		}

		const data = await this.getGameData( gameId );
		this.logger.debug( "<< getGameByCode()" );
		return data;
	}

	/**
	 * Creates a new game with the specified parameters.
	 * This method initializes the game data with the provided deal count and trump suit,
	 * and sets the initial state of the game.
	 *
	 * @param {Callbreak.CreateGameInput} input The input containing deal count and trump suit.
	 * @param {AuthInfo} authInfo The authenticated user's information
	 * @return {Callbreak.GameData} The initialized game data with the new game and player information.
	 */
	createGame( { dealCount = 5, trumpSuit }: Callbreak.CreateGameInput, authInfo: AuthInfo ): Callbreak.GameData {
		this.logger.debug( ">> createGame()" );

		const player: Callbreak.Player = { ...authInfo, isBot: false };
		const data: Callbreak.GameData = {
			game: {
				id: generateId(),
				code: generateGameCode(),
				dealCount,
				trump: trumpSuit,
				currentTurn: authInfo.id,
				status: "CREATED",
				scores: { [ authInfo.id ]: [] },
				createdBy: authInfo.id
			},
			players: { [ authInfo.id ]: player },
			deals: []
		};

		this.logger.debug( "<< createGame()" );
		return data;
	}

	/**
	 * Adds the player to the game data.
	 * This method is called after successful validation of the join game request.
	 * It updates the players in the game data with the authenticated user's information.
	 *
	 * @param {Callbreak.GameData} data The current game data.
	 * @param {AuthInfo} authInfo The authenticated user's information.
	 * @return {Callbreak.GameData} The updated game data with the new player added.
	 */
	joinGame( data: Callbreak.GameData, authInfo: AuthInfo ): Callbreak.GameData {
		this.logger.debug( ">> joinGame()" );
		data.players[ authInfo.id ] = { ...authInfo, isBot: false };
		data.game.scores[ authInfo.id ] = [];
		this.logger.debug( "<< joinGame()" );
		return data;
	}

	/**
	 * Retrieves the game store for the current player.
	 * This method extracts the relevant game data for the authenticated user,
	 * including the current deal and hand.
	 *
	 * @param {Callbreak.GameData} data The current game data containing game, deals, and players.
	 * @param {AuthInfo} authInfo The authenticated user's information.
	 * @returns {Callbreak.Store} The game store containing the player's hand, current deal, and round information.
	 */
	getGameStore( data: Callbreak.GameData, authInfo: AuthInfo ): Callbreak.Store {
		const { game, deals, players } = data;
		const currentDeal = deals.length > 0 ? deals[ 0 ] : undefined;

		if ( !currentDeal ) {
			this.logger.error( "No deals found in the game data!" );
			return { playerId: authInfo.id, game, players, hand: [], currentDeal: undefined };
		}

		const hand = currentDeal.hands[ authInfo.id ] || [];
		const currentRound = currentDeal.rounds.length > 0 ? currentDeal.rounds[ 0 ] : undefined;
		if ( !currentRound ) {
			this.logger.error( "No rounds found in the current deal!" );
			return { playerId: authInfo.id, game, players, currentDeal, hand };
		}

		return { playerId: authInfo.id, game, players, hand, currentDeal, currentRound };
	}

	/**
	 * Adds bots to the game data.
	 * This method is called when the game has less than 4 players.
	 * It generates bot player information and adds them to the game data.
	 *
	 * @param {Callbreak.GameData} data The current game data.
	 * @return {Callbreak.GameData} The updated game data with bots added.
	 */
	addBots( data: Callbreak.GameData ): Callbreak.GameData {
		this.logger.debug( ">> addBots()" );

		const botCount = 4 - Object.keys( data.players ).length;
		for ( let i = 0; i < botCount; i++ ) {
			const botInfo = generateBotInfo();
			data.players[ botInfo.id ] = { ...botInfo, isBot: true };
			data.game.scores[ botInfo.id ] = [];
		}

		this.logger.debug( "<< addBots()" );
		return data;
	}

	/**
	 * Creates a new deal in the game.
	 * This method generates a deck of cards, shuffles it, and deals hands to the players.
	 * It also sets the player order based on the current game state.
	 *
	 * @param {Callbreak.GameData} data The current game data.
	 * @return {Callbreak.GameData} The updated game data with the new deal created.
	 */
	createDeal( data: Callbreak.GameData ): Callbreak.GameData {
		this.logger.debug( ">> createDeal()" );

		const deck = generateDeck();
		const hands = generateHands( deck, 4 );
		const playerIds = Object.keys( data.players ).toSorted();
		const playerOrder = data.deals.length === 0 ?
			[
				...playerIds.slice( playerIds.indexOf( data.game.createdBy ) ),
				...playerIds.slice( 0, playerIds.indexOf( data.game.createdBy ) )
			] :
			[ ...data.deals[ 0 ].playerOrder.slice( 1 ), data.deals[ 0 ].playerOrder[ 0 ] ];

		const deal: Callbreak.DealWithRounds = {
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
				{} as Callbreak.HandData
			)
		};

		data.deals.unshift( deal );
		data.game.status = "IN_PROGRESS";
		data.game.currentTurn = deal.playerOrder[ 0 ];

		this.logger.debug( "<< createDeal()" );
		return data;
	}

	/**
	 * Declares the number of wins for the current deal.
	 * This method updates the current deal's declarations with the player's input.
	 * It also updates the current turn to the next player in the order.
	 *
	 * @param {Callbreak.DeclareDealWinsInput} input The input containing the number of wins declared by the player.
	 * @param {Callbreak.GameData} data The current game data.
	 * @returns {Callbreak.GameData} The updated game data with the declared wins.
	 */
	declareDealWins( input: Callbreak.DeclareDealWinsInput, data: Callbreak.GameData ): Callbreak.GameData {
		this.logger.debug( ">> declareDealWins()" );

		if ( Object.keys( data.deals[ 0 ].declarations ).length === 0 ) {
			data.deals[ 0 ].status = "IN_PROGRESS";
		}

		const nextPlayerIdx = ( data.deals[ 0 ].playerOrder.indexOf( data.game.currentTurn ) + 1 ) % 4;
		data.deals[ 0 ].declarations[ data.game.currentTurn ] = input.wins;
		data.game.currentTurn = data.deals[ 0 ].playerOrder[ nextPlayerIdx ];

		this.logger.debug( "<< declareDealWins()" );
		return data;
	}

	/**
	 * Creates a new round in the current deal.
	 * This method initializes a new round with the player order based on the winner of the last round.
	 * It also sets the current turn to the first player in the order.
	 *
	 * @param {Callbreak.GameData} data The current game data containing the active deal.
	 * @returns {Callbreak.GameData} The updated game data with the new round created.
	 */
	createRound( data: Callbreak.GameData ): Callbreak.GameData {
		this.logger.debug( ">> createRound()" );

		const activeDeal = data.deals[ 0 ];
		const lastRound = activeDeal.rounds[ 0 ];
		const playerOrder = !lastRound ? activeDeal.playerOrder : [
			...lastRound.playerOrder.slice( lastRound.playerOrder.indexOf( lastRound.winner! ) ),
			...lastRound.playerOrder.slice( 0, lastRound.playerOrder.indexOf( lastRound.winner! ) )
		];

		const round: Callbreak.Round = {
			id: generateId(),
			playerOrder,
			status: "CREATED",
			cards: {},
			createdAt: Date.now()
		};

		activeDeal.rounds.unshift( round );
		data.deals[ 0 ] = activeDeal;
		data.game.currentTurn = playerOrder[ 0 ];

		this.logger.debug( "<< createRound()" );
		return data;
	}

	/**
	 * Plays a card in the current round.
	 * This method updates the round's cards with the player's played card,
	 * sets the suit if it's the first card played,
	 * and updates the player's hand by removing the played card.
	 * It also updates the current turn to the next player in the order.
	 *
	 * @param {Callbreak.PlayCardInput} input The input containing the card ID, round ID, deal ID, and authInfo.
	 * @param {Callbreak.GameData} data The current game data containing the active deal and round.
	 * @returns {Callbreak.GameData} The updated game data with the played card and updated turn.
	 */
	playCard( input: Callbreak.PlayCardInput, data: Callbreak.GameData ): Callbreak.GameData {
		this.logger.debug( ">> playCard()" );

		const activeDeal = data.deals[ 0 ];
		const activeRound = activeDeal.rounds[ 0 ];
		const playerInfo = data.players[ data.game.currentTurn ];

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

		const nextPlayerIdx = ( activeRound.playerOrder.indexOf( data.game.currentTurn ) + 1 ) % 4;
		data.game.currentTurn = activeRound.playerOrder[ nextPlayerIdx ];
		data.deals[ 0 ] = activeDeal;

		this.logger.debug( "<< playCard()" );
		return data;
	}

	/**
	 * Completes the current round by determining the winning card.
	 * This method finds the best card played in the round,
	 * updates the round's status to completed,
	 * and records the winner.
	 *
	 * @param {Callbreak.GameData} data The current game data containing the active deal and round.
	 * @returns {Callbreak.GameData} The updated game data with the completed round and winner recorded.
	 */
	completeRound( data: Callbreak.GameData ): Callbreak.GameData {
		this.logger.debug( ">> completeRound()" );

		const activeDeal = data.deals[ 0 ];
		const activeRound = activeDeal.rounds[ 0 ];

		const winningCard = getBestCardPlayed(
			Object.values( activeRound.cards ).map( getCardFromId ),
			data.game.trump,
			activeRound.suit
		);

		this.logger.info( "Winning Card: %s", winningCard );

		const winningPlayer = activeRound.playerOrder.find( p => activeRound.cards[ p ] === getCardId( winningCard! ) );
		this.logger.info( "Player %s won the round", winningPlayer );

		activeRound.status = "COMPLETED";
		activeRound.winner = winningPlayer;
		activeDeal.wins[ winningPlayer! ] = ( activeDeal.wins[ winningPlayer! ] || 0 ) + 1;

		activeDeal.rounds[ 0 ] = activeRound;
		data.deals[ 0 ] = activeDeal;

		this.logger.debug( "<< completeRound()" );
		return data;
	}

	/**
	 * Completes the current deal by calculating scores for each player.
	 * This method iterates through the players' declarations and wins,
	 * calculates the score based on the rules,
	 * and updates the game scores accordingly.
	 * It also marks the deal as completed.
	 *
	 * @param {Callbreak.GameData} data The current game data containing the active deal.
	 * @returns {Callbreak.GameData} The updated game data with the completed deal and scores calculated.
	 */
	completeDeal( data: Callbreak.GameData ): Callbreak.GameData {
		this.logger.debug( ">> completeDeal()" );

		const activeDeal = data.deals[ 0 ];
		Object.keys( data.players ).forEach( playerId => {
			const declared = activeDeal.declarations[ playerId ];
			const won = activeDeal.wins[ playerId ] ?? 0;
			const score = declared > won ? ( -10 * declared ) : ( 10 * declared ) + ( 2 * ( won - declared ) );
			data.game.scores[ playerId ].push( score );
		} );

		activeDeal.status = "COMPLETED";
		data.deals[ 0 ] = activeDeal;

		this.logger.debug( "<< completeDeal()" );
		return data;
	}

	/**
	 * Validates the join game request.
	 * Checks if the game exists, if the player is already in the game,
	 * and if the game is full.
	 * If any validation fails, it throws an error.
	 *
	 * @param {Callbreak.GameData} data - The current game data.
	 * @param {AuthInfo} authInfo - The authentication information of the player.
	 */
	validateJoinGame( data: Callbreak.GameData, authInfo: AuthInfo ) {
		this.logger.debug( ">> validateJoinGame()" );

		if ( !!data.players[ authInfo.id ] ) {
			this.logger.warn( "Player Already Joined: %s", authInfo.id );
			return data;
		}

		if ( Object.keys( data.players ).length >= 4 ) {
			this.logger.error( "Game Full: %s", data.game.id );
			throw "Game Full!";
		}

		this.logger.debug( "<< validateJoinGame()" );
		return data;
	}

	/**
	 * Validates the declaration of deal wins.
	 * Checks if the deal exists, if it has no rounds,
	 * and if it's the player's turn.
	 * If any validation fails, it throws an error.
	 *
	 * @param {Callbreak.DeclareDealWinsInput} input - The input containing deal ID, wins and authInfo
	 * @param {AuthInfo} authInfo - The authentication information of the player.
	 * @param {Callbreak.GameData} data - The current game data.
	 */
	validateDealWinDeclaration(
		input: Callbreak.DeclareDealWinsInput,
		data: Callbreak.GameData,
		authInfo: AuthInfo
	) {
		this.logger.debug( ">> validateDealWinDeclaration()" );

		if ( data.game.currentTurn !== authInfo.id ) {
			this.logger.error( "Not Your Turn: %s", authInfo.id );
			throw "Not Your Turn!";
		}

		const deal = data.deals[ 0 ];
		if ( !deal || deal.rounds.length !== 0 || deal.id !== input.dealId ) {
			this.logger.error( "Active Deal Not Found: %s", data.game.id );
			throw "Deal Not Found!";
		}

		this.logger.debug( "<< validateDealWinDeclaration()" );
		return data;
	}

	/**
	 * Validates the play card action.
	 * Checks if it's the player's turn, if the deal exists,
	 * if the round exists, if the card is in the player's hand,
	 * and if the card can be played according to the game rules.
	 * If any validation fails, it throws an error.
	 *
	 * @param {Callbreak.PlayCardInput} input - The input containing card ID, round ID, deal ID and authInfo
	 * @param {AuthInfo} authInfo - The authentication information of the player.
	 * @param {Callbreak.GameData} data - The current game data.
	 */
	validatePlayCard( input: Callbreak.PlayCardInput, data: Callbreak.GameData, authInfo: AuthInfo ) {
		this.logger.debug( ">> validatePlayCard()" );

		if ( data.game.currentTurn !== authInfo.id ) {
			this.logger.error( "Not Your Turn: %s", authInfo.id );
			throw "Not Your Turn!";
		}

		const deal = data.deals[ 0 ];
		if ( !deal || deal.id !== input.dealId ) {
			this.logger.error( "Deal Not Found: %s", input.dealId );
			throw "Deal Not Found!";
		}

		const round = deal.rounds[ 0 ];
		if ( !round ) {
			this.logger.error( "Round Not Found: %s", input.roundId );
			throw "Round Not Found!";
		}

		const hand = deal.hands[ authInfo.id ];
		if ( !isCardInHand( hand, input.cardId ) ) {
			this.logger.error( "Card Not Yours: %s", input.cardId );
			throw "Card Not Yours!";
		}

		const cardsPlayedInRound = Object.values( round.cards ).map( getCardFromId );
		const isCardPlayAllowed = canCardBePlayed(
			input.cardId,
			hand,
			data.game.trump,
			cardsPlayedInRound,
			round.suit
		);

		if ( !isCardPlayAllowed ) {
			this.logger.error( "Invalid Card: %s", input.cardId );
			throw "Invalid Card!";
		}

		this.logger.debug( "<< validatePlayCard()" );
		return data;
	}

	/**
	 * Suggests the number of wins a player can declare based on their hand and the trump suit.
	 * This method analyzes the player's hand, counts the possible winning cards,
	 * and returns a suggested number of wins.
	 *
	 * @param {PlayingCard[]} hand - The player's hand of cards.
	 * @param {CardSuit} trumpSuit - The current trump suit in the game.
	 * @returns {number} The suggested number of wins for the player.
	 */
	suggestDealWins( hand: PlayingCard[], trumpSuit: CardSuit ): number {
		this.logger.debug( ">> suggestDealWins()" );

		let possibleWins = 0;
		const BIG_RANKS = [ CARD_RANKS.ACE, CARD_RANKS.KING, CARD_RANKS.QUEEN ] as CardRank[];
		for ( const suit of Object.values( CARD_SUITS ) ) {
			const cards = getCardsOfSuit( suit, hand );
			const bigRanks = cards.filter( card => BIG_RANKS.includes( card.rank ) );

			if ( suit === trumpSuit ) {
				possibleWins += bigRanks.length;
				continue;
			}

			if ( cards.length >= 3 ) {
				possibleWins += Math.min( bigRanks.length, 2 );
			} else if ( cards.length === 2 ) {
				possibleWins += 1 + Math.min( bigRanks.length, 1 );
			} else {
				possibleWins += 2 + bigRanks.length;
			}
		}

		if ( possibleWins < 2 ) {
			possibleWins = 2;
		}

		this.logger.debug( "<< suggestDealWins()" );
		return possibleWins;
	}

	/**
	 * Suggests a card to play based on the player's hand, the active round, and the cards already played.
	 * This method analyzes the playable cards in the hand, checks for unbeatable cards,
	 * and returns a suggested card to play.
	 *
	 * @param {PlayingCard[]} hand - The player's hand of cards.
	 * @param {Callbreak.Round} activeRound - The current active round in the game.
	 * @param {PlayingCard[]} cardsAlreadyPlayed - The cards that have already been played in the current round.
	 * @param {CardSuit} trumpSuit - The current trump suit in the game.
	 * @returns {PlayingCard} The suggested card to play.
	 */
	suggestCardToPlay(
		hand: PlayingCard[],
		activeRound: Callbreak.Round,
		cardsAlreadyPlayed: PlayingCard[],
		trumpSuit: CardSuit
	): PlayingCard {
		this.logger.debug( ">> suggestCardToPlay()" );

		const cardsPlayedInActiveRound = Object.values( activeRound.cards ).map( getCardFromId );
		const bestCardInActiveRound = getBestCardPlayed( cardsPlayedInActiveRound, trumpSuit, activeRound.suit );
		const playableCards = getPlayableCards( hand, trumpSuit, bestCardInActiveRound, activeRound.suit );

		const deck = generateDeck();
		const unbeatableCards = playableCards.filter( card => {
			const greaterCards = deck.filter( deckCard => compareCards( deckCard, card ) );
			return greaterCards.every( greaterCard => cardsAlreadyPlayed.includes( greaterCard ) );
		} );

		const cardToPlay = unbeatableCards.length > 0
			? unbeatableCards[ Math.floor( Math.random() * unbeatableCards.length ) ]
			: playableCards[ Math.floor( Math.random() * playableCards.length ) ];

		this.logger.debug( "<< suggestCardToPlay()" );
		return cardToPlay;
	}
}