import type { AuthInfo } from "@/auth/types";
import type {
	CreateGameInput,
	DealWithRounds,
	DeclareDealWinsInput,
	GameData,
	PlayCardInput,
	PlayerGameInfo,
	PlayerId,
	Round,
	SaveFn
} from "@/callbreak/types";
import { canCardBePlayed, getBestCardPlayed, getPlayableCards } from "@/callbreak/utils";
import { remove } from "@/shared/utils/array";
import {
	CARD_RANKS,
	CARD_SUITS,
	type CardRank,
	compareCards,
	generateDeck,
	generateHands,
	getCardFromId,
	getCardId,
	getCardsOfSuit,
	getCardSuit,
	isCardInHand,
	type PlayingCard
} from "@/shared/utils/cards";
import { generateBotInfo, generateGameCode, generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";

/**
 * @class CallbreakEngine
 * @description Core engine for managing the Callbreak card game.
 * The CallbreakEngine class encapsulates the core logic of the Callbreak card game.
 * It manages the game state, processes player actions, and enforces game rules.
 * The engine provides methods to create a new game, add players, declare wins,
 * play cards, and automatically progress the game through its various states.
 * It ensures that the game rules are followed and maintains the integrity of the game state.
 */
export class CallbreakEngine {

	private readonly logger = createLogger( "Callbreak:Engine" );
	private readonly data: GameData;
	private readonly save: SaveFn;

	/**
	 * Initializes a new instance of the CallbreakEngine with the provided game data.
	 * It sets up the initial game state and prepares the engine for gameplay.
	 *
	 * @constructor
	 * @param data {GameData} - The initial game data to set up the engine.
	 * @param saveFn {SaveFn} - A function to save the game data, typically to a database or storage.
	 */
	public constructor( data: GameData, saveFn: SaveFn ) {
		this.data = data;
		this.save = saveFn;
	}

	/**
	 * Gets the unique identifier of the game.
	 * This ID is used to reference the game in various operations and is immutable once the game is created.
	 *
	 * @return {string} - The unique identifier of the game.
	 */
	public get id(): string {
		return this.data.id;
	}

	/**
	 * Creates a new Callbreak game with the specified parameters.
	 * This function initializes the game state with the player's ID, deal count, and trump suit.
	 * Defaults to a deal count of 5 if not specified.
	 *
	 * @param input {CreateGameInput} - The input parameters containing deal count and trump suit.
	 * @param playerId {PlayerId} - The ID of the player creating the game.
	 * @param saveFn {SaveFn} - A function to save the game data, typically to a database or storage.
	 * @return {CallbreakEngine} - A new instance of the CallbreakEngine initialized with the created game data.
	 */
	public static create( input: CreateGameInput, playerId: PlayerId, saveFn: SaveFn ): CallbreakEngine {
		const { dealCount = 5, trumpSuit } = input;
		const data: GameData = {
			id: generateId(),
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

		return new CallbreakEngine( data, saveFn );
	}

	/**
	 * Retrieves the game data specific to a player.
	 * This function returns the game state including the current deal, current round,
	 * and the player's hand, while excluding sensitive information like other players' hands.
	 *
	 * @param playerId {PlayerId} - The ID of the player requesting the game data.
	 * @return {PlayerGameInfo} - The player-specific game data.
	 */
	public getPlayerData( playerId: PlayerId ): PlayerGameInfo {
		const { deals, players, ...rest } = this.data;
		const { rounds, hands, ...currentDeal } = deals[ 0 ];
		const currentRound = rounds[ 0 ];
		return { ...rest, playerId, currentDeal, currentRound, hand: hands[ playerId ] || [], players };
	}

	/**
	 * Adds a player to the game using the provided authentication information.
	 * This function updates the game state to include the new player and initializes their score.
	 * If the maximum number of players (4) is reached, the game status is updated to "PLAYERS_READY".
	 *
	 * @param playerInfo {AuthInfo} - The authentication information of the player to be added.
	 */
	public addPlayer( playerInfo: AuthInfo ) {
		this.logger.debug( ">> addPlayer()" );

		this.validateJoinGame( playerInfo );

		this.data.players[ playerInfo.id ] = { ...playerInfo, isBot: false };
		this.data.scores[ playerInfo.id ] = [];

		if ( Object.keys( this.data.players ).length === 4 ) {
			this.data.status = "PLAYERS_READY";
		}

		this.logger.debug( "<< addPlayer()" );
	}

	/**
	 * Allows the current player to declare their expected wins for the active deal.
	 * This function updates the deal's declarations and advances the turn to the next player.
	 * If all players have declared their wins, the game status is updated to "WINS_DECLARED".
	 *
	 * @param input {DeclareDealWinsInput} - The input containing the number of wins declared by the current player.
	 * @param authInfo {AuthInfo} - The authentication information of the player declaring wins.
	 */
	public declareDealWins( input: DeclareDealWinsInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> declareDealWins()" );

		this.validateDealWinDeclaration( input, authInfo );

		if ( Object.keys( this.data.deals[ 0 ].declarations ).length === 0 ) {
			this.data.deals[ 0 ].status = "IN_PROGRESS";
		}

		const nextPlayerIdx = ( this.data.deals[ 0 ].playerOrder.indexOf( this.data.currentTurn ) + 1 ) % 4;
		this.data.deals[ 0 ].declarations[ this.data.currentTurn ] = input.wins;
		this.data.currentTurn = this.data.deals[ 0 ].playerOrder[ nextPlayerIdx ];

		if ( Object.keys( this.data.deals[ 0 ].declarations ).length === 4 ) {
			this.data.status = "WINS_DECLARED";
		}

		this.logger.debug( "<< declareDealWins()" );
	}

	/**
	 * Processes the action of a player playing a card during their turn in the active round.
	 * This function updates the round's state with the played card, removes the card from the player's hand,
	 * and advances the turn to the next player. If all players have played their cards,
	 * the game status is updated to "CARDS_PLAYED".
	 *
	 * @param input {PlayCardInput} - The input containing the ID of the card played by the current player.
	 * @param authInfo {AuthInfo} - The authentication information of the player playing the card.
	 */
	public playCard( input: PlayCardInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> playCard()" );

		this.validatePlayCard( input, authInfo );

		const activeDeal = this.data.deals[ 0 ];
		const activeRound = activeDeal.rounds[ 0 ];
		const playerInfo = this.data.players[ this.data.currentTurn ];

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
			this.data.status = "CARDS_PLAYED";
		}

		const nextPlayerIdx = ( activeRound.playerOrder.indexOf( this.data.currentTurn ) + 1 ) % 4;
		this.data.currentTurn = activeRound.playerOrder[ nextPlayerIdx ];
		this.data.deals[ 0 ] = activeDeal;

		this.logger.debug( "<< playCard()" );
	}

	/**
	 * Automatically progresses the game based on its current state.
	 * This function handles various game states such as adding bots, creating deals and rounds,
	 * declaring wins, playing cards, and completing rounds and deals.
	 * It ensures that the game flows smoothly without manual intervention,
	 * especially when bot players are involved.
	 */
	public async autoplay() {
		this.logger.debug( ">> autoplay()" );

		switch ( this.data.status ) {
			case "GAME_CREATED": {
				this.addBots();
				await this.saveGameData();
				break;
			}

			case "PLAYERS_READY": {
				this.createDeal();
				await this.saveGameData();
				break;
			}

			case "CARDS_DEALT": {
				const currentDeal = this.data.deals[ 0 ];
				const currentPlayer = this.data.players[ this.data.currentTurn ];
				if ( currentPlayer.isBot ) {
					const wins = this.suggestDealWins();
					const input = { gameId: this.data.id, dealId: currentDeal.id, wins };
					this.declareDealWins( input, currentPlayer );
					await this.saveGameData();
				}
				break;
			}

			case "WINS_DECLARED": {
				this.createRound();
				await this.saveGameData();
				break;
			}

			case "ROUND_STARTED": {
				const currentDeal = this.data.deals[ 0 ];
				const currentRound = currentDeal.rounds[ 0 ];
				const currentPlayer = this.data.players[ this.data.currentTurn ];
				if ( currentPlayer.isBot ) {
					const card = this.suggestCardToPlay();
					const input = {
						gameId: this.data.id,
						dealId: currentDeal.id,
						roundId: currentRound.id,
						cardId: getCardId( card )
					};
					this.playCard( input, currentPlayer );
					await this.saveGameData();
				}
				break;
			}

			case "CARDS_PLAYED": {
				this.completeRound();
				await this.saveGameData();
				break;
			}

			case "ROUND_COMPLETED": {
				const currentDeal = this.data.deals[ 0 ];
				if ( currentDeal.rounds.length === 13 ) {
					this.completeDeal();
				} else {
					this.createRound();
				}
				await this.saveGameData();
				break;
			}

			case "DEAL_COMPLETED": {
				if ( this.data.deals.length < this.data.dealCount ) {
					this.createDeal();
				} else {
					this.data.status = "GAME_COMPLETED";
				}
				await this.saveGameData();
				break;
			}
		}

		this.logger.debug( "<< autoplay()" );
	}

	/**
	 * Saves the current game data using the provided save function.
	 * This function needs to be called after making any changes to the game state
	 * to ensure that the updated state is persisted.
	 */
	public async saveGameData() {
		await this.save( this.data );
	}

	/**
	 * Validates the join game request.
	 * Checks if the game exists, if the player is already in the game,
	 * and if the game is full.
	 * If any validation fails, it returns an error.
	 *
	 * @private
	 * @param {AuthInfo} authInfo - The authentication information of the player.
	 */
	private validateJoinGame( authInfo: AuthInfo ) {
		this.logger.debug( ">> validateJoinGame()" );

		if ( this.data.players[ authInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", authInfo.id );
			return;
		}

		if ( Object.keys( this.data.players ).length >= 4 ) {
			this.logger.error( "Game Full: %s", this.data.id );
			throw "Game full!";
		}

		this.logger.debug( "<< validateJoinGame()" );
	}

	/**
	 * Validates the declaration of deal wins.
	 * Checks if the deal exists, if it has no rounds,
	 * and if it's the player's turn.
	 * If any validation fails, it returns an error.
	 *
	 * @private
	 * @param {DeclareDealWinsInput} input - The input containing deal ID, wins and authInfo
	 * @param {AuthInfo} authInfo - The authentication information of the player.
	 */
	private validateDealWinDeclaration( input: DeclareDealWinsInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> validateDealWinDeclaration()" );

		if ( this.data.currentTurn !== authInfo.id ) {
			this.logger.error( "Not Your Turn: %s", authInfo.id );
			throw "Not your turn!";
		}

		const deal = this.data.deals[ 0 ];
		if ( !deal || deal.rounds.length !== 0 || deal.id !== input.dealId ) {
			this.logger.error( "Active Deal Not Found: %s", this.data.id );
			throw "Active deal not found!";
		}

		this.logger.debug( "<< validateDealWinDeclaration()" );
	}

	/**
	 * Validates the play card action.
	 * Checks if it's the player's turn, if the deal exists,
	 * if the round exists, if the card is in the player's hand,
	 * and if the card can be played according to the game rules.
	 * If any validation fails, it returns an error.
	 *
	 * @private
	 * @param {PlayCardInput} input - The input containing card ID, round ID, deal ID and authInfo
	 * @param {AuthInfo} authInfo - The authentication information of the player.
	 */
	private validatePlayCard( input: PlayCardInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> validatePlayCard()" );

		if ( this.data.currentTurn !== authInfo.id ) {
			this.logger.error( "Not Your Turn: %s", authInfo.id );
			throw "Not your turn!";
		}

		const deal = this.data.deals[ 0 ];
		if ( !deal || deal.id !== input.dealId ) {
			this.logger.error( "Deal Not Found: %s", input.dealId );
			throw "Deal not found!";
		}

		const round = deal.rounds[ 0 ];
		if ( !round ) {
			this.logger.error( "Round Not Found: %s", input.roundId );
			throw "Round not found!";
		}

		const hand = deal.hands[ authInfo.id ];
		if ( !isCardInHand( hand, input.cardId ) ) {
			this.logger.error( "Card Not Yours: %s", input.cardId );
			throw "Card not in hand!";
		}

		const cardsPlayed = Object.values( round.cards ).map( getCardFromId );
		const isCardPlayAllowed = canCardBePlayed( input.cardId, hand, this.data.trump, cardsPlayed, round.suit );

		if ( !isCardPlayAllowed ) {
			this.logger.error( "Invalid Card: %s", input.cardId );
			throw "Card cannot be played!";
		}

		this.logger.debug( "<< validatePlayCard()" );
	}

	/**
	 * Adds bot players to the game until the total number of players reaches 4.
	 * This function generates bot player information and updates the game state accordingly.
	 * Once the maximum number of players is reached, the game status is updated to "PLAYERS_READY".
	 * @private
	 */
	private addBots() {
		this.logger.debug( ">> addBots()" );

		const botCount = 4 - Object.keys( this.data.players ).length;
		for ( let i = 0; i < botCount; i++ ) {
			const botInfo = generateBotInfo();
			this.data.players[ botInfo.id ] = { ...botInfo, isBot: true };
			this.data.scores[ botInfo.id ] = [];
		}

		this.data.status = "PLAYERS_READY";
		this.logger.debug( "<< addBots()" );
	}

	/**
	 * Creates a new deal in the game by generating a deck of cards, shuffling them,
	 * and distributing them among the players. The player order is determined based on
	 * the creator of the game for the first deal, and subsequently rotates for each new deal.
	 * The game status is updated to "CARDS_DEALT" and the current turn is set to the first player in the order.
	 * @private
	 */
	private createDeal() {
		this.logger.debug( ">> createDeal()" );

		const deck = generateDeck();
		const hands = generateHands( deck, 4 );
		const playerIds = Object.keys( this.data.players ).toSorted();
		const playerOrder = this.data.deals.length === 0
			? [
				...playerIds.slice( playerIds.indexOf( this.data.createdBy ) ),
				...playerIds.slice( 0, playerIds.indexOf( this.data.createdBy ) )
			]
			: [ ...this.data.deals[ 0 ].playerOrder.slice( 1 ), this.data.deals[ 0 ].playerOrder[ 0 ] ];

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
				{} as Record<PlayerId, PlayingCard[]>
			)
		};

		this.data.deals.unshift( deal );
		this.data.status = "CARDS_DEALT";
		this.data.currentTurn = deal.playerOrder[ 0 ];

		this.logger.debug( "<< createDeal()" );
	}

	/**
	 * Creates a new round within the active deal, setting up the player order based on the winner of the last round.
	 * The game status is updated to "ROUND_STARTED" and the current turn is set to the first player
	 * in the new round's order.
	 * @private
	 */
	private createRound() {
		this.logger.debug( ">> createRound()" );

		const activeDeal = this.data.deals[ 0 ];
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
		this.data.deals[ 0 ] = activeDeal;
		this.data.currentTurn = playerOrder[ 0 ];
		this.data.status = "ROUND_STARTED";

		this.logger.debug( "<< createRound()" );
	}

	/**
	 * Completes the active round by determining the winning card and player,
	 * updating the round and deal states accordingly, and setting the game status to "ROUND_COMPLETED".
	 * The winning player is determined based on the best card played considering the trump suit and round suit.
	 * The number of wins for the winning player is incremented in the active deal.
	 * @private
	 */
	private completeRound() {
		this.logger.debug( ">> completeRound()" );

		const activeDeal = this.data.deals[ 0 ];
		const activeRound = activeDeal.rounds[ 0 ];

		const winningCard = getBestCardPlayed(
			Object.values( activeRound.cards ).map( getCardFromId ),
			this.data.trump,
			activeRound.suit
		);

		this.logger.info( "Winning Card: %s", winningCard );

		const winningPlayer = activeRound.playerOrder.find( p => activeRound.cards[ p ] === getCardId( winningCard! ) );
		this.logger.info( "Player %s won the round", winningPlayer );

		activeRound.status = "COMPLETED";
		activeRound.winner = winningPlayer;
		activeDeal.wins[ winningPlayer! ] = ( activeDeal.wins[ winningPlayer! ] || 0 ) + 1;

		activeDeal.rounds[ 0 ] = activeRound;
		this.data.deals[ 0 ] = activeDeal;
		this.data.status = "ROUND_COMPLETED";

		this.logger.debug( "<< completeRound()" );
	}

	/**
	 * Completes the active deal by calculating and updating the scores for each player
	 * based on their declared and actual wins. The deal status is set to "COMPLETED"
	 * and the game status is updated to "DEAL_COMPLETED".
	 * The scoring system penalizes players for not able to meet their declared wins
	 * and rewards them for exceeding their declarations.
	 * The score formula is as follows:
	 * - If declared wins > actual wins: score = -10 * declared wins
	 * - If declared wins <= actual wins: score = (10 * declared wins) + (2 * (actual wins - declared wins))
	 * @private
	 */
	private completeDeal() {
		this.logger.debug( ">> completeDeal()" );

		const activeDeal = this.data.deals[ 0 ];
		Object.keys( this.data.players ).forEach( playerId => {
			const declared = activeDeal.declarations[ playerId ];
			const won = activeDeal.wins[ playerId ] ?? 0;
			const score = declared > won ? ( -10 * declared ) : ( 10 * declared ) + ( 2 * ( won - declared ) );
			this.data.scores[ playerId ].push( score );
		} );

		activeDeal.status = "COMPLETED";
		this.data.deals[ 0 ] = activeDeal;
		this.data.status = "DEAL_COMPLETED";

		this.logger.debug( "<< completeDeal()" );
	}

	/**
	 * Suggests the number of wins a player might achieve based on their current hand.
	 * This function analyzes the player's hand, considering the trump suit and high-ranking cards,
	 * to estimate a realistic number of wins they could declare for the active deal.
	 * The suggestion is based on the distribution of cards across suits and the presence of
	 * high-value cards (Ace, King, Queen).
	 * @private
	 * @return {number} - The suggested number of wins for the player.
	 */
	private suggestDealWins(): number {
		this.logger.debug( ">> suggestDealWins()" );

		let possibleWins = 0;
		const activeDeal = this.data.deals[ 0 ];
		const hand = activeDeal.hands[ this.data.currentTurn ];
		const BIG_RANKS = [ CARD_RANKS.ACE, CARD_RANKS.KING, CARD_RANKS.QUEEN ] as CardRank[];

		for ( const suit of Object.values( CARD_SUITS ) ) {
			const cards = getCardsOfSuit( suit, hand );
			const bigRanks = cards.filter( card => BIG_RANKS.includes( card.rank ) );

			if ( suit === this.data.trump ) {
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
	 * Suggests a card for the current player to play based on the game state.
	 * This function analyzes the player's hand, the cards already played in the active round,
	 * and the best card played so far to determine a strategic card to play.
	 * The suggestion aims to play an unbeatable card if possible, otherwise selects a random playable card.
	 * @private
	 * @return {PlayingCard} - The suggested card for the player to play.
	 */
	private suggestCardToPlay(): PlayingCard {
		this.logger.debug( ">> suggestCardToPlay()" );

		const activeDeal = this.data.deals[ 0 ];
		const activeRound = activeDeal.rounds[ 0 ];
		const hand = activeDeal.hands[ this.data.currentTurn ];
		const cardsAlreadyPlayed = activeDeal.rounds
			.flatMap( round => Object.values( round.cards ) )
			.map( getCardFromId );

		const cardsPlayedInActiveRound = Object.values( activeRound.cards ).map( getCardFromId );
		const bestCardInActiveRound = getBestCardPlayed( cardsPlayedInActiveRound, this.data.trump, activeRound.suit );
		const playableCards = getPlayableCards( hand, this.data.trump, bestCardInActiveRound, activeRound.suit );

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