import { CARD_RANKS, CARD_SUITS } from "@s2h/cards/constants";
import type { CardRank, PlayingCard } from "@s2h/cards/types";
import {
	compareCards,
	generateDeck,
	generateHands,
	getCardFromId,
	getCardId,
	getCardsOfSuit,
	getCardSuit
} from "@s2h/cards/utils";
import { remove } from "@s2h/utils/array";
import { generateBotInfo, generateGameCode, generateId } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import { DurableObject } from "cloudflare:workers";
import type {
	BasePlayerInfo,
	CreateGameInput,
	DealWithRounds,
	DeclareDealWinsInput,
	GameData,
	PlayCardInput,
	PlayerGameInfo,
	PlayerId,
	Round
} from "./types.ts";
import { getBestCardPlayed, getPlayableCards } from "./utils.ts";

type CloudflareEnv = {
	CALLBREAK_KV: KVNamespace;
	WSS: DurableObjectNamespace<import("../../../api/src/wss.ts").WebsocketServer>;
}

/**
 * @class CallbreakEngine
 * @description Durable Object that manages the state and logic of a Callbreak game.
 * It handles player actions, game progression, and state persistence.
 * The engine supports adding players, declaring wins, playing cards, and automatically
 * progressing the game through alarms.
 */
export class CallbreakEngine extends DurableObject<CloudflareEnv> {

	private readonly logger = createLogger( "Callbreak:Engine" );
	private readonly key: string;
	private data: GameData;

	constructor( ctx: DurableObjectState, env: CloudflareEnv ) {
		super( ctx, env );
		this.key = ctx.id.toString();
		this.data = CallbreakEngine.initialGameData( { dealCount: 5, trumpSuit: CARD_SUITS.HEARTS } );

		ctx.blockConcurrencyWhile( async () => {
			const data = await this.loadGameData();
			if ( data ) {
				this.data = data;
			} else {
				this.logger.info( "No existing game data found, starting new game." );
				await this.saveGameData();
			}
		} );
	}

	/**
	 * Creates a new Callbreak game with the specified parameters.
	 * This function initializes the game state with the player's ID, deal count, and trump suit.
	 * Defaults to a deal count of 5 if not specified.
	 *
	 * @param input {CreateGameInput} - The input parameters containing deal count and trump suit.
	 * @return {GameData} - Default GameData
	 */
	public static initialGameData( input: CreateGameInput ): GameData {
		const { dealCount = 5, trumpSuit } = input;
		return {
			id: generateId(),
			code: generateGameCode(),
			dealCount,
			trump: trumpSuit,
			currentTurn: "",
			status: "GAME_CREATED",
			scores: {},
			createdBy: "",
			players: {},
			deals: []
		};
	}

	public async getPlayerData( playerId: PlayerId ) {
		this.logger.debug( ">> getPlayerData()" );
		const playerDataMap = this.getPlayerDataMap();
		const data = playerDataMap[ playerId ];
		this.logger.debug( "<< getPlayerData()" );
		return { data };
	}

	public async updateConfig( input: Partial<CreateGameInput>, playerId: PlayerId ) {
		this.logger.debug( ">> updateConfig()" );

		this.data.dealCount = input.dealCount ?? this.data.dealCount;
		this.data.trump = input.trumpSuit ?? this.data.trump;
		this.data.currentTurn = playerId;
		this.data.createdBy = playerId;

		await this.saveGameData();
		await this.setAlarm( 60000 );

		this.logger.debug( "<< updateConfig()" );
		return { code: this.data.code, gameId: this.data.id };
	}

	/**
	 * Adds a player to the game using the provided authentication information.
	 * This function updates the game state to include the new player and initializes their score.
	 * If the maximum number of players (4) is reached, the game status is updated to "PLAYERS_READY".
	 *
	 * @param playerInfo {BasePlayerInfo} - The authentication information of the player to be added.
	 */
	public async addPlayer( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> addPlayer()" );

		this.data.players[ playerInfo.id ] = { ...playerInfo, isBot: false };
		this.data.scores[ playerInfo.id ] = [];

		if ( Object.keys( this.data.players ).length === 4 ) {
			this.data.status = "PLAYERS_READY";
		}

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< addPlayer()" );
	}

	/**
	 * Allows the current player to declare their expected wins for the active deal.
	 * This function updates the deal's declarations and advances the turn to the next player.
	 * If all players have declared their wins, the game status is updated to "WINS_DECLARED".
	 *
	 * @param input {DeclareDealWinsInput} - The input containing the number of wins declared by the current player.
	 */
	public async declareDealWins( input: DeclareDealWinsInput ) {
		this.logger.debug( ">> declareDealWins()" );

		if ( Object.keys( this.data.deals[ 0 ].declarations ).length === 0 ) {
			this.data.deals[ 0 ].status = "IN_PROGRESS";
		}

		const nextPlayerIdx = ( this.data.deals[ 0 ].playerOrder.indexOf( this.data.currentTurn ) + 1 ) % 4;
		this.data.deals[ 0 ].declarations[ this.data.currentTurn ] = input.wins;
		this.data.currentTurn = this.data.deals[ 0 ].playerOrder[ nextPlayerIdx ];

		if ( Object.keys( this.data.deals[ 0 ].declarations ).length === 4 ) {
			this.data.status = "WINS_DECLARED";
		}

		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );

		this.logger.debug( "<< declareDealWins()" );
	}

	/**
	 * Processes the action of a player playing a card during their turn in the active round.
	 * This function updates the round's state with the played card, removes the card from the player's hand,
	 * and advances the turn to the next player. If all players have played their cards,
	 * the game status is updated to "CARDS_PLAYED".
	 *
	 * @param input {PlayCardInput} - The input containing the ID of the card played by the current player.
	 */
	public async playCard( input: PlayCardInput ) {
		this.logger.debug( ">> playCard()" );

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

		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );

		this.logger.debug( "<< playCard()" );
	}

	/**
	 * Automatically progresses the game based on its current data.
	 * This function handles various game states such as adding bots, creating deals and rounds,
	 * declaring wins, playing cards, and completing rounds and deals.
	 * It ensures that the game flows smoothly without manual intervention,
	 * especially when bot players are involved.
	 */
	override async alarm() {
		this.logger.debug( ">> alarm()" );

		let setNextAlarm = false;
		switch ( this.data.status ) {
			case "GAME_CREATED": {
				this.addBots();
				setNextAlarm = true;
				break;
			}

			case "PLAYERS_READY": {
				this.createDeal();
				setNextAlarm = true;
				break;
			}

			case "CARDS_DEALT": {
				const currentDeal = this.data.deals[ 0 ];
				const currentPlayer = this.data.players[ this.data.currentTurn ];
				if ( currentPlayer.isBot ) {
					const wins = this.suggestDealWins();
					const input = { gameId: this.data.id, dealId: currentDeal.id, wins };
					await this.declareDealWins( input );
					setNextAlarm = true;
				}
				break;
			}

			case "WINS_DECLARED": {
				this.createRound();
				setNextAlarm = true;
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
					await this.playCard( input );
					setNextAlarm = true;
				}
				break;
			}

			case "CARDS_PLAYED": {
				this.completeRound();
				setNextAlarm = true;
				break;
			}

			case "ROUND_COMPLETED": {
				const currentDeal = this.data.deals[ 0 ];
				if ( currentDeal.rounds.length === 13 ) {
					this.completeDeal();
				} else {
					this.createRound();
				}
				setNextAlarm = true;
				break;
			}

			case "DEAL_COMPLETED": {
				if ( this.data.deals.length < this.data.dealCount ) {
					this.createDeal();
					setNextAlarm = true;
				} else {
					await this.completeGame();
				}
				break;
			}
		}

		if ( setNextAlarm ) {
			await this.setAlarm( 5000 );
		}

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< alarm()" );
	}

	private getPlayerDataMap(): Record<PlayerId, PlayerGameInfo> {
		return Object.keys( this.data.players ).reduce(
			( acc, playerId ) => {
				const { deals, players, ...rest } = this.data;
				if ( !deals[ 0 ] ) {
					acc[ playerId ] = { ...rest, playerId, hand: [], players };
					return acc;
				}

				const { rounds, hands, ...currentDeal } = deals[ 0 ];
				const hand = hands[ playerId ] ?? [];
				const currentRound = rounds[ 0 ];
				acc[ playerId ] = { ...rest, playerId, currentDeal, currentRound, hand, players };

				return acc;
			},
			{} as Record<string, PlayerGameInfo>
		);
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

		const winningPlayer = activeRound.playerOrder.find( p => activeRound.cards[ p ] ===
			getCardId( winningCard! ) );
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

	private async completeGame() {
		this.logger.debug( ">> completeGame()" );
		this.data.status = "GAME_COMPLETED";
		this.logger.debug( "<< completeGame()" );
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
	 * Suggests a card for the current player to play based on the game data.
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
		const bestCardInActiveRound = getBestCardPlayed(
			cardsPlayedInActiveRound,
			this.data.trump,
			activeRound.suit
		);
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

	private async broadcastGameData() {
		this.logger.debug( ">> broadcast()" );

		const durableObjectId = this.env.WSS.idFromName( `callbreak:${ this.data.id }` );
		const wss = this.env.WSS.get( durableObjectId );
		await wss.broadcast( this.getPlayerDataMap() );

		this.logger.debug( "<< broadcast()" );
	}

	private async setAlarm( ms: number ) {
		this.logger.info( "Setting alarm for gameId:", this.data.id, "in", ms, "ms" );
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.setAlarm( Date.now() + ms );
	}

	private async loadGameData() {
		return this.env.CALLBREAK_KV.get<GameData>( this.key, "json" );
	}

	private async saveGameData() {
		await this.env.CALLBREAK_KV.put( this.key, JSON.stringify( this.data ) );
	}
}