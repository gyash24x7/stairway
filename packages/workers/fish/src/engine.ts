import { remove, shuffle } from "@s2h/utils/array";
import {
	CARD_RANKS,
	type CardId,
	generateDeck,
	generateHands,
	getCardDisplayString,
	getCardRank
} from "@s2h/utils/cards";
import { generateBotInfo, generateId } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import { DurableObject } from "cloudflare:workers";
import { format } from "node:util";
import type {
	AskCardInput,
	BasePlayerInfo,
	Bindings,
	CanadianBook,
	ClaimBookInput,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	NormalBook,
	PlayerGameInfo,
	PlayerId,
	TeamCount,
	TransferTurnInput
} from "./types.ts";
import {
	CANADIAN_BOOKS,
	DEFAULT_METRICS,
	GAME_STATUS,
	getBookForCard,
	getDefaultGameData,
	NORMAL_BOOKS,
	suggestAsks,
	suggestBooks,
	suggestClaims,
	suggestRiskyClaims,
	suggestTransfers
} from "./utils.ts";

/**
 * Durable Object implementing the authoritative Fish game engine.
 * Behavioral overview:
 * - Manages game state, player actions, and turn progression.
 * - Validates all incoming actions to enforce game rules.
 * - Persists state changes to KV storage.
 * - Broadcasts state updates to connected clients via WebSocket.
 * - Implements bot player logic for automated gameplay.
 *
 * @class FishEngine
 * @public
 */
export class FishEngine extends DurableObject<Bindings> {

	protected data: GameData;
	private readonly logger = createLogger( "Fish:Engine" );
	private readonly key: string;

	constructor( ctx: DurableObjectState, env: Bindings ) {
		super( ctx, env );
		this.key = ctx.id.toString();
		this.data = getDefaultGameData();

		ctx.blockConcurrencyWhile( async () => {
			const data = await this.loadGameData();
			if ( data ) {
				this.data = data;
			}

			await this.saveGameData();
		} );
	}

	/**
	 * Initialize a new game instance with the provided configuration and creator info.
	 * Behaviour:
	 * - Validates initialization
	 * - Sets game configuration, current turn, and creator
	 * - Adds the creating player to the game
	 * - Persists and broadcasts the initial state.
	 *
	 * @see {@link FishEngine#validateInitialization} for validation details.
	 *
	 * @param input game configuration payload.
	 * @param playerInfo metadata for the creating player.
	 * @returns object with game id on success or error description on failure.
	 * @public
	 */
	public async initialize( input: CreateGameInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> initialize()" );

		const { error } = this.validateInitialization( input );
		if ( error ) {
			this.logger.error( "Initialization failed:", error );
			return { error };
		}

		this.data.config.playerCount = input.playerCount;
		this.data.config.type = input.type;
		this.data.config.teamCount = input.teamCount;
		this.data.config.deckType = input.playerCount % 3 === 0 || input.type === "CANADIAN" ? 48 : 52;
		this.data.config.bookSize = input.type === "NORMAL" ? 4 : 6;

		this.data.currentTurn = playerInfo.id;
		this.data.createdBy = playerInfo.id;

		await this.addPlayer( playerInfo );

		await this.saveDurableObjectId();
		await this.saveGameData();

		this.logger.debug( "<< initialize()" );
		return { data: this.data.id };
	}

	/**
	 * Add a player to the game if allowed.
	 * Behaviour:
	 * - Validate player addition conditions
	 * - Update player lists and metrics
	 * - Transition game status to PLAYERS_READY if full
	 * - Persist and broadcast updated state.
	 *
	 * @see {@link FishEngine#validatePlayerAddition} for validation details.
	 *
	 * @param playerInfo player metadata for the joining participant.
	 * @returns object with game id on success or an error description on failure.
	 * @public
	 */
	public async addPlayer( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> addPlayer()" );

		if ( this.data.players[ playerInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", playerInfo.id );
			return { data: this.data.id };
		}

		const { error } = this.validatePlayerAddition();
		if ( error ) {
			this.logger.error( "Player addition failed:", error );
			return { error };
		}

		this.data.playerIds.push( playerInfo.id );
		this.data.players[ playerInfo.id ] = {
			...playerInfo,
			teamId: "",
			teamMates: [],
			opponents: [],
			isBot: false
		};

		this.data.metrics[ playerInfo.id ] = DEFAULT_METRICS;

		if ( this.data.playerIds.length === this.data.config.playerCount ) {
			this.data.status = GAME_STATUS.PLAYERS_READY;
		}

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< addPlayer()" );
		return { data: this.data.id };
	}

	/**
	 * Fill remaining seats with bot players.
	 * Behaviour:
	 * - Validate bot addition conditions
	 * - Update player lists and metrics
	 * - Transition game status to PLAYERS_READY
	 * - Persist and broadcast updated state.
	 *
	 * @see {@link FishEngine#validatePlayerAddition} for validation details.
	 *
	 * @param playerInfo caller metadata used to validate creator privilege.
	 * @returns empty object on success or error description on failure.
	 * @public
	 */
	public async addBots( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> addBots()" );

		if ( this.data.createdBy !== playerInfo.id ) {
			this.logger.error( "Only the game creator can add bots! GameId: %s", this.data.id );
			return { error: "Only the game creator can add bots!" };
		}

		const { error } = this.validatePlayerAddition();
		if ( error ) {
			this.logger.error( "Bot addition failed:", error );
			return { error };
		}

		const botsToAdd = this.data.config.playerCount - this.data.playerIds.length;
		for ( let i = 0; i < botsToAdd; i++ ) {
			const botInfo = generateBotInfo();
			this.data.playerIds.push( botInfo.id );
			this.data.players[ botInfo.id ] = { ...botInfo, teamId: "", teamMates: [], opponents: [], isBot: true };
			this.data.metrics[ botInfo.id ] = DEFAULT_METRICS;
		}

		this.data.status = GAME_STATUS.PLAYERS_READY;

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< addBots()" );
		return {};
	}

	/**
	 * Create teams from the provided mapping and update per-player team relationships.
	 * Behaviour:
	 * - Validate team creation
	 * - Mutate team structures and per-player team/opponent lists
	 * - Transition game status to TEAMS_CREATED, persist and broadcast.
	 *
	 * @see {@link FishEngine#validateTeamCreation} for validation details.
	 *
	 * @param input mapping of team name to list of player ids.
	 * @param playerInfo caller metadata used to validate permission.
	 * @returns empty object on success or error description on failure.
	 * @public
	 */
	public async createTeams( input: CreateTeamsInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> createTeams()" );

		const { error } = this.validateTeamCreation( input, playerInfo );
		if ( error ) {
			this.logger.error( "Team creation failed:", error );
			return { error };
		}

		this.data.config.teamCount = Object.keys( input ).length as TeamCount;
		Object.entries( input ).forEach( ( [ name, members ] ) => {
			const id = generateId();
			this.data.teamIds.push( id );
			this.data.teams[ id ] = { id, name, players: members, score: 0, booksWon: [] };
			members.forEach( playerId => {
				this.data.players[ playerId ].teamId = id;
				this.data.players[ playerId ].teamMates = remove( p => p === playerId, members );
				this.data.players[ playerId ].opponents = remove( p => members.includes( p ), this.data.playerIds );
			} );
		} );

		this.data.status = GAME_STATUS.TEAMS_CREATED;

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< createTeams()" );
		return {};
	}

	/**
	 * Start the game: select books, build and deal the deck, initialize book tracking.
	 * Behaviour:
	 * - Validate start conditions
	 * - Select books based on game type
	 * - Generate and deal the deck according to player count and deck type
	 * - Initialize card ownership mappings and card locations
	 * - Transition game status to IN_PROGRESS, persist and broadcast.
	 *
	 * @see {@link FishEngine#validateStartGame} for validation details.
	 *
	 * @param playerInfo caller metadata; used to validate the start operation.
	 * @returns empty object on success or error description on failure.
	 * @public
	 */
	public async startGame( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> startGame()" );

		const { error } = this.validateStartGame( playerInfo );
		if ( error ) {
			this.logger.error( "Game start failed:", error );
			return { error };
		}

		this.data.config.books = this.data.config.type === "NORMAL"
			? Object.keys( NORMAL_BOOKS ).map( k => k as NormalBook )
			: Object.keys( CANADIAN_BOOKS ).map( k => k as CanadianBook );

		let deck = generateDeck();
		if ( this.data.config.deckType === 48 ) {
			deck = remove( ( card ) => getCardRank( card ) === CARD_RANKS.SEVEN, deck );
		}

		const hands = generateHands( deck, this.data.config.playerCount );
		this.data.playerIds.forEach( ( playerId, idx ) => {
			this.data.hands[ playerId ] = hands[ idx ];
			this.data.cardCounts[ playerId ] = hands[ idx ].length;
			hands[ idx ].forEach( card => {
				this.data.cardMappings[ card ] = playerId;
			} );
		} );

		this.data.status = GAME_STATUS.IN_PROGRESS;
		this.data.cardLocations = deck.reduce(
			( acc, card ) => {
				acc[ card ] = this.data.playerIds;
				return acc;
			},
			{} as Partial<Record<CardId, PlayerId[]>>
		);

		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< startGame()" );
		return {};
	}

	/**
	 * Handle a player's ask action (request a card from another player).
	 * Behaviour:
	 * - Validate the ask; compute whether the ask succeeds by consulting card->owner mapping.
	 * - Create a descriptive historical entry and update lastMoveType.
	 * - On success: move the card owner, update hands/cardCounts/cardMappings, and mark knownOwner.
	 * - On failure: prune possibleOwners for the card and mark knownOwner if only one remains.
	 * - Update per-player metrics and advance currentTurn according to rules.
	 * - Persist and broadcast state after mutation.
	 *
	 * @see {@link FishEngine#validateAsk} for validation details.
	 *
	 * @param input payload describing the ask (from and cardId).
	 * @param playerInfo authenticated caller metadata (must be current turn).
	 * @returns empty object on success or error description on validation failure.
	 * @public
	 */
	public async askCard( input: AskCardInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> askCard()" );

		const { error } = this.validateAsk( input, playerInfo );
		if ( error ) {
			this.logger.error( "Ask card failed:", error );
			return { error };
		}

		const playerId = this.data.currentTurn;
		const success = input.from === this.data.cardMappings[ input.cardId ];
		const receivedString = success ? "got the card!" : "was declined!";
		const cardDisplayString = getCardDisplayString( input.cardId );
		const description = format(
			"%s asked %s for %s and %s",
			this.data.players[ playerId ].name,
			this.data.players[ input.from ].name,
			cardDisplayString,
			receivedString
		);

		const ask = { id: generateId(), success, description, ...input, timestamp: Date.now(), playerId };
		this.data.askHistory.unshift( ask );
		this.data.lastMoveType = "ask";

		const nextTurn = !ask.success ? ask.from : ask.playerId;
		if ( nextTurn !== this.data.currentTurn ) {
			this.data.currentTurn = nextTurn;
		}

		if ( success ) {
			this.data.cardMappings[ ask.cardId ] = ask.playerId;
			this.data.hands[ ask.playerId ].push( input.cardId );
			this.data.hands[ ask.from ] = remove( card => card === ask.cardId, this.data.hands[ ask.from ] );
			this.data.cardCounts[ ask.playerId ]++;
			this.data.cardCounts[ ask.from ]--;
		}

		const possibleOwners = this.data.cardLocations[ input.cardId ]!;
		this.data.cardLocations[ input.cardId ] = success
			? [ ask.playerId ]
			: remove( p => p === ask.from || p === ask.playerId, possibleOwners );

		this.data.metrics[ ask.playerId ].totalAsks++;
		this.data.metrics[ ask.playerId ].cardsTaken += success ? 1 : 0;
		this.data.metrics[ ask.from ].cardsGiven += success ? 0 : 1;

		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );

		this.logger.debug( "<< askCard()" );
		return {};
	}

	/**
	 * Handle a player's claim that they control all cards of a book.
	 * Behaviour:
	 * - Validate the claim (correct turn, correct number of cards, players exist).
	 * - Compute the actual owner mapping for the called cards and determine claim success.
	 * - On success: remove cards from play, update hands and counts, award the book to the claimant's team.
	 * - On failure: award the book to the opposing team.
	 * - Update claim history, per-player metrics, and check for game completion.
	 * - Persist and broadcast changes.
	 *
	 * @see {@link FishEngine#validateClaim} for validation details.
	 *
	 * @param input mapping from card ids to claimed owner ids.
	 * @param playerInfo authenticated caller metadata (must be current turn).
	 * @returns empty object on success or error description on validation failure.
	 * @public
	 */
	public async claimBook( input: ClaimBookInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> claimBook()" );

		const { error } = this.validateClaim( input, playerInfo );
		if ( error ) {
			this.logger.error( "Claim book failed:", error );
			return { error };
		}

		const playerId = this.data.currentTurn;
		const calledCards = Object.keys( input ).map( cardId => cardId as CardId );
		const [ calledBook ] = calledCards.map( cardId => getBookForCard( cardId, this.data.config.type ) );
		const correctClaim = calledCards.reduce(
			( acc, cardId ) => {
				acc[ cardId ] = this.data.cardMappings[ cardId ];
				return acc;
			},
			{} as Partial<Record<CardId, string>>
		);

		let success = true;
		for ( const cardId of calledCards ) {
			if ( correctClaim[ cardId ] !== input[ cardId ] ) {
				success = false;
				break;
			}
		}

		const description = format(
			"%s declared %s %s",
			this.data.players[ playerId ].name,
			calledBook,
			success ? "correctly!" : "incorrectly!"
		);

		const claim = {
			id: generateId(),
			success,
			description,
			playerId,
			book: calledBook,
			correctClaim,
			actualClaim: input,
			timestamp: Date.now()
		};

		this.data.claimHistory.unshift( claim );

		calledCards.map( cardId => {
			delete this.data.cardMappings[ cardId ];
			delete this.data.cardLocations[ cardId ];

			const hand = this.data.hands[ correctClaim[ cardId ]! ];
			this.data.hands[ correctClaim[ cardId ]! ] = remove( card => card === cardId, hand );
			this.data.cardCounts[ correctClaim[ cardId ]! ]--;
		} );

		let winningTeamId = this.data.players[ playerId ].teamId;

		if ( !success ) {
			[ winningTeamId ] = this.data.teamIds.filter( teamId => teamId !== winningTeamId );
		}

		this.data.teams[ winningTeamId ].score++;
		this.data.teams[ winningTeamId ].booksWon.push( calledBook );

		const opponentsWithCards = this.data.players[ playerId ].opponents
			.filter( opponentId => !!this.data.cardCounts[ opponentId ] );

		this.data.currentTurn = !success ? shuffle( opponentsWithCards )[ 0 ] : playerId;
		this.data.lastMoveType = "claim";

		this.data.metrics[ playerId ].totalClaims++;
		this.data.metrics[ playerId ].successfulClaims += success ? 1 : 0;

		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );

		this.logger.debug( "<< claimBook()" );
		return {};
	}

	/**
	 * Transfer the current turn to a teammate, typically after a successful claim.
	 * Behaviour:
	 * - Validates the transfer conditions.
	 * - Updates currentTurn, lastMoveType, and transfer history.
	 * - Persists and broadcasts the updated state.
	 *
	 * @see {@link FishEngine#validateTransfer} for validation details.
	 *
	 * @param input transfer payload specifying the receiving player.
	 * @param playerInfo authenticated caller metadata.
	 * @returns empty object on success or error description on validation failure.
	 * @public
	 */
	public async transferTurn( input: TransferTurnInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> transferTurn()" );

		const { error } = this.validateTransfer( input, playerInfo );
		if ( error ) {
			this.logger.error( "Transfer turn failed:", error );
			return { error };
		}

		const transferringPlayer = this.data.players[ this.data.currentTurn ];
		const receivingPlayer = this.data.players[ input.transferTo ];

		const transfer = {
			id: generateId(),
			playerId: transferringPlayer.id,
			description: `${ transferringPlayer.name } transferred the turn to ${ receivingPlayer.name }`,
			transferTo: input.transferTo,
			timestamp: Date.now()
		};

		this.data.currentTurn = input.transferTo;
		this.data.lastMoveType = "transfer";
		this.data.transferHistory.unshift( transfer );

		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );

		this.logger.debug( "<< transferTurn()" );
		return {};
	}

	/**
	 * Build the player-facing view for a single player.
	 * Behaviour:
	 * - Strips secret global-only structures and returns the requesting player's hand
	 *   and shared metadata needed by the client.
	 *
	 * @param playerId id of the requesting player.
	 * @returns object containing the per-player view or an error description.
	 * @public
	 */
	public async getPlayerData( playerId: PlayerId ) {

		if ( !this.data.players[ playerId ] ) {
			this.logger.error( "Player %s is not part of the game! GameId: %s", playerId, this.data.id );
			return { error: `Player ${ playerId } is not part of the game!` };
		}

		const { hands, cardMappings, ...rest } = this.data;
		return { data: { ...rest, playerId, hand: hands[ playerId ] || [] } };
	}

	/**
	 * Durable Object alarm handler that drives bot decisions and automated progression.
	 * Behaviour and algorithmic notes:
	 * - If the current player is a bot and the game is in progress, the handler:
	 *   1. Builds weighted book suggestions for priorities.
	 *   2. If the previous move was a successful claim, try transfers prioritized by teammate utility.
	 *   3. Attempt deterministic claims when all card owners are known or inferred.
	 *   4. Otherwise pick the top-weighted ask suggestion (opponent holding a missing card).
	 * - Chosen actions invoke the public handlers (transfer/claim/ask).
	 * - Invoked action handlers cause state mutations and schedules follow-up alarms.
	 *
	 * @public
	 * @override
	 */
	override async alarm() {
		this.logger.debug( ">> alarm()" );

		const playerGameInfo = this.getPlayerDataMap()[ this.data.currentTurn ];
		const booksCompleted = Object.values( this.data.teams ).flatMap( team => team.booksWon );

		this.logger.debug( "BooksCompleted: %o", booksCompleted );
		if ( booksCompleted.length === 8 ) {
			this.data.status = GAME_STATUS.COMPLETED;
			this.logger.info( "Game %s completed!", this.data.id );

			await this.saveGameData();
			await this.broadcastGameData();

			this.logger.debug( "<< alarm()" );
			return;
		}

		const currentPlayer = this.data.players[ this.data.currentTurn ];
		if ( this.data.status !== GAME_STATUS.IN_PROGRESS || !currentPlayer.isBot ) {
			this.logger.debug( "No bot action required at this time." );
			this.logger.debug( "<< alarm()" );
			return;
		}

		this.logger.debug( "Player Hand: %o", this.data.hands[ currentPlayer.id ] );

		const weightedBooks = suggestBooks( playerGameInfo );
		this.logger.debug( "Books Suggested: %o", weightedBooks.map( book => book.book ) );

		const isLastMoveSuccessfulClaim = this.data.lastMoveType === "claim"
			&& this.data.claimHistory[ 0 ]?.success
			&& this.data.claimHistory[ 0 ]?.playerId === this.data.currentTurn;

		const weightedTransfers = suggestTransfers( playerGameInfo );
		this.logger.debug(
			"Transfers Suggested: %o",
			weightedTransfers.map( transfer => transfer.transferTo )
		);

		if ( isLastMoveSuccessfulClaim && weightedTransfers.length > 0 ) {
			const transferTo = weightedTransfers[ 0 ].transferTo;
			this.logger.info( "Bot %s transferring turn to %s", currentPlayer.id, transferTo );
			const input: TransferTurnInput = { transferTo };
			await this.transferTurn( input, currentPlayer );

			await this.setAlarm( 5000 );
			await this.saveGameData();
			await this.broadcastGameData();

			this.logger.debug( "<< alarm()" );
			return;
		}

		this.logger.info( "Bot %s skipping transfer!", currentPlayer.id );

		const weightedClaims = suggestClaims( weightedBooks, playerGameInfo );
		this.logger.debug( "Claims Suggested: %o", weightedClaims.map( claim => claim.book ) );

		if ( weightedClaims.length > 0 ) {
			const claim = weightedClaims[ 0 ].claim;
			this.logger.info( "Bot %s claiming book with cards: %o", currentPlayer.id, claim );
			const input: ClaimBookInput = claim;
			await this.claimBook( input, currentPlayer );

			await this.setAlarm( 5000 );
			await this.saveGameData();
			await this.broadcastGameData();

			this.logger.debug( "<< alarm()" );
			return;
		}

		this.logger.info( "Bot %s skipping claim!", currentPlayer.id );

		const weightedAsks = suggestAsks( weightedBooks, playerGameInfo );
		this.logger.debug( "Asks Suggested: %o", new Set( weightedAsks.map( ask => ask.cardId ) ) );
		if ( weightedAsks.length > 0 ) {
			const { playerId, cardId } = weightedAsks[ 0 ];
			this.logger.info( "Bot %s asking %s for card %s", currentPlayer.id, playerId, cardId );
			const event: AskCardInput = { from: playerId, cardId };
			await this.askCard( event, currentPlayer );

			await this.setAlarm( 5000 );
			await this.saveGameData();
			await this.broadcastGameData();

			this.logger.debug( "<< alarm()" );
			return;
		}

		this.logger.info( "Bot %s skipping ask!", currentPlayer.id );

		const riskyClaims = suggestRiskyClaims( weightedBooks, playerGameInfo );
		this.logger.debug( "Risky Claims Suggested: %o", riskyClaims.map( claim => claim.book ) );

		const input = riskyClaims[ 0 ].claim;
		this.logger.info( "Bot %s making risky claim for book with cards: %o", currentPlayer.id, input );
		await this.claimBook( input, currentPlayer );

		await this.setAlarm( 5000 );
		await this.saveGameData();
		await this.broadcastGameData();

		this.logger.debug( "<< alarm()" );
	}

	/**
	 * Request a storage alarm after deleting any existing alarm.
	 * Behaviour:
	 * - Deletes any pending alarm and schedules a new one relative to now.
	 * - Invokes storage alarm APIs on the Durable Object context.
	 *
	 * @param ms milliseconds in the future to schedule the alarm.
	 * @private
	 */
	public async setAlarm( ms: number ) {
		this.logger.info( "Setting alarm for gameId:", this.data.id, "in", ms, "ms" );
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.setAlarm( Date.now() + ms );
	}

	/**
	 * Validate a transfer request; used before mutating state.
	 * Checks:
	 * - Caller is on-turn
	 * - Game is in IN_PROGRESS state
	 * - Last move was a successful claim
	 * - Caller made the successful claim
	 * - Receiving player exists
	 * - Receiving player has cards
	 * - Receiving player is a teammate
	 *
	 * @param input transfer payload.
	 * @param playerInfo caller authentication info.
	 * @returns empty object when valid, otherwise an error description.
	 * @private
	 */
	private validateTransfer( input: TransferTurnInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validateTransfer()" );

		if ( this.data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", this.data.id );
			return { error: "The Game is not in IN_PROGRESS state!" };
		}

		const currentPlayer = this.data.players[ this.data.currentTurn ];
		if ( currentPlayer.id !== playerInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", this.data.id, playerInfo.id );
			return { error: "Not your turn!" };
		}

		const receivingPlayer = this.data.players[ input.transferTo ];

		if ( !receivingPlayer ) {
			this.logger.error( "The Receiving Player is not part of the Game!" );
			return { error: "The Receiving Player is not part of the Game!" };
		}

		if ( receivingPlayer.teamId !== currentPlayer.teamId ) {
			this.logger.error( "Turn can only be transferred to member of your team!" );
			return { error: "Turn can only be transferred to member of your team!" };
		}

		if ( this.data.cardCounts[ input.transferTo ] === 0 ) {
			this.logger.error( "Turn can only be transferred to a player with cards!" );
			return { error: "Turn can only be transferred to a player with cards!" };
		}

		const lastClaim = this.data.claimHistory[ 0 ];
		if ( this.data.lastMoveType !== "claim" || !lastClaim || !lastClaim.success ) {
			this.logger.error( "Turn can only be transferred after a successful claim!" );
			return { error: "Turn can only be transferred after a successful claim!" };
		}

		if ( lastClaim.playerId !== currentPlayer.id ) {
			this.logger.error( "Only the player who made the successful claim can transfer the turn!" );
			return { error: "Only the player who made the successful claim can transfer the turn!" };
		}

		this.logger.debug( "<< validateTransfer()" );
		return {};
	}

	/**
	 * Validate a claim request.
	 * Checks:
	 * - Caller is on-turn
	 * - Game is in IN_PROGRESS state
	 * - Correct number of cards called for game type
	 * - All called players exist
	 * - Caller called own cards
	 * - All called cards are from the same book
	 * - All called players are from the same team
	 *
	 * @param input mapping of card ids to claimed owners.
	 * @param playerInfo caller authentication info.
	 * @returns empty object when valid, otherwise an error description.
	 * @private
	 */
	private validateClaim( input: ClaimBookInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validateClaim()" );

		if ( this.data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", this.data.id );
			return { error: "The Game is not in IN_PROGRESS state!" };
		}

		const currentPlayer = this.data.players[ this.data.currentTurn ];
		if ( currentPlayer.id !== playerInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", this.data.id, playerInfo.id );
			return { error: "Not your turn!" };
		}

		const claimedCards = Object.keys( input ).map( key => key as CardId );
		if ( claimedCards.length !== this.data.config.bookSize ) {
			this.logger.error( "Incorrect number of cards claimed! UserId: %s", this.data.currentTurn );
			return { error: "Incorrect number of cards claimed!" };
		}

		for ( const pid of Object.values( input ) ) {
			if ( !this.data.players[ pid ] ) {
				this.logger.error( "Player %s is not part of the game! GameId: %s", pid, this.data.id );
				return { error: `Player ${ pid } is not part of the game!` };
			}
		}

		if ( !Object.values( input ).includes( playerInfo.id ) ) {
			this.logger.error( "Claiming Player did not claim own cards! UserId: %s", playerInfo.id );
			return { error: "Claiming Player did not claim own cards!" };
		}

		const claimedBooks = new Set( claimedCards.map( cardId => getBookForCard( cardId, this.data.config.type ) ) );
		if ( claimedBooks.size !== 1 ) {
			this.logger.error( "Cards Claimed from multiple books! UserId: %s", this.data.currentTurn );
			return { error: "Cards Claimed from multiple books!" };
		}

		const claimingTeams = new Set( Object.values( input ).map( pid => this.data.players[ pid ].teamId ) );
		if ( claimingTeams.size !== 1 ) {
			this.logger.error( "Book claimed from multiple teams! UserId: %s", this.data.currentTurn );
			return { error: "Book claimed from multiple teams!" };
		}

		this.logger.debug( "<< validateClaim()" );
		return {};
	}

	/**
	 * Validate an ask action.
	 * Checks:
	 * - Caller is on-turn
	 * - Game is in IN_PROGRESS state
	 * - Asked player exists
	 * - Asked card exists
	 * - Asked card is not with asking player
	 * - Asked player is not a teammate
	 *
	 * @param input ask payload (from and cardId).
	 * @param playerInfo caller authentication info.
	 * @returns empty object when valid, otherwise an error description.
	 * @private
	 */
	private validateAsk( input: AskCardInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validateAsk()" );

		if ( this.data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", this.data.id );
			return { error: "The Game is not in IN_PROGRESS state!" };
		}

		const currentPlayer = this.data.players[ this.data.currentTurn ];
		if ( currentPlayer.id !== playerInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", this.data.id, playerInfo.id );
			return { error: "Not your turn!" };
		}

		const askedPlayer = this.data.players[ input.from ];
		if ( !askedPlayer ) {
			this.logger.error( "Asked player %s is not part of the game! GameId: %s", input.from, this.data.id );
			return { error: `Asked player ${ input.from } is not part of the game!` };
		}

		const askingPlayerTeam = this.data.teams[ currentPlayer.teamId ];
		const askedPlayerTeam = this.data.teams[ askedPlayer.teamId ];
		if ( askedPlayerTeam === askingPlayerTeam ) {
			this.logger.debug( "The asked player is from the same team! GameId: %s", this.data.id );
			return { error: "The asked player is from the same team!" };
		}

		if ( this.data.cardMappings[ input.cardId ] === currentPlayer.id ) {
			this.logger.debug( "The asked card is with asking player itself! GameId: %s", this.data.id );
			return { error: "The asked card is with asking player itself!" };
		}

		if ( !this.data.cardLocations[ input.cardId ] ) {
			this.logger.error( "Card %s does not exist in the game! GameId: %s", input.cardId, this.data.id );
			return { error: `Card ${ input.cardId } does not exist in the game!` };
		}

		this.logger.debug( "<< validateAsk()" );
		return {};
	}

	/**
	 * Validate that the caller may start the game.
	 * Checks:
	 * - Caller is the game creator
	 * - Game is in TEAMS_CREATED state
	 *
	 * @param playerInfo caller authentication info.
	 * @returns empty object when valid, otherwise an error description.
	 * @private
	 */
	private validateStartGame( playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validateStartGame()" );

		if ( this.data.createdBy !== playerInfo.id ) {
			this.logger.error( "Only the game creator can start the game! GameId: %s", this.data.id );
			return { error: "Only the game creator can start the game!" };
		}

		if ( this.data.status !== GAME_STATUS.TEAMS_CREATED ) {
			this.logger.error( "The Game is not in TEAMS_CREATED state! GameId: %s", this.data.id );
			return { error: "The Game is not in TEAMS_CREATED state!" };
		}

		this.logger.debug( "<< validateStartGame()" );
		return {};
	}

	/**
	 * Validate team creation inputs.
	 * Checks:
	 * - Caller is the game creator
	 * - Game is in PLAYERS_READY state
	 * - Player count matches configuration
	 * - Team count matches configuration
	 * - All players are assigned to teams
	 * - Each team has the correct number of players.
	 * - All specified players exist in the game.
	 *
	 * @param input team mapping provided by the caller.
	 * @param playerInfo caller authentication info.
	 * @returns empty object when valid, otherwise an error description.
	 * @private
	 */
	private validateTeamCreation( input: CreateTeamsInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> validateTeamCreation()" );

		if ( this.data.createdBy !== playerInfo.id ) {
			this.logger.error( "Only the game creator can create teams! GameId: %s", this.data.id );
			return { error: "Only the game creator can create teams!" };
		}

		if ( this.data.status !== GAME_STATUS.PLAYERS_READY ) {
			this.logger.error( "The Game is not in PLAYERS_READY state! GameId: %s", this.data.id );
			return { error: "The Game is not in PLAYERS_READY state!" };
		}

		const teamCount = Object.keys( input ).length;
		if ( teamCount !== this.data.config.teamCount ) {
			this.logger.error( "Team count does not match the game configuration! GameId: %s", this.data.id );
			return { error: "Team count does not match the game configuration!" };
		}

		const playersSpecified = new Set( Object.values( input ).flat() );
		if ( playersSpecified.size !== this.data.config.playerCount ) {
			this.logger.error( "Not all players are divided into teams! GameId: %s", this.data.id );
			return { error: "Not all players are divided into teams!" };
		}

		const playersPerTeam = this.data.config.playerCount / teamCount;
		for ( const [ teamName, playerIds ] of Object.entries( input ) ) {
			if ( playerIds.length !== playersPerTeam ) {
				this.logger.error( "Invalid number of players in team %s! GameId: %s", teamName, this.data.id );
				return { error: `Invalid number of players in team ${ teamName }!` };
			}

			for ( const playerId of playerIds ) {
				if ( !this.data.players[ playerId ] ) {
					this.logger.error( "Player %s is not part of the game! GameId: %s", playerId, this.data.id );
					return { error: `Player ${ playerId } is not part of the game!` };
				}
			}
		}

		this.logger.debug( "<< validateTeamCreation()" );
		return {};
	}

	/**
	 * Validate whether a new player may be added.
	 * Checks:
	 * - Game must be in CREATED state
	 * - Player count must not exceed configured maximum.
	 *
	 * @returns empty object when valid, otherwise an error description.
	 * @private
	 */
	private validatePlayerAddition() {
		this.logger.debug( ">> validatePlayerAddition()" );

		if ( this.data.playerIds.length >= this.data.config.playerCount ) {
			this.logger.error( "Game Full: %s", this.data.id );
			return { error: "Game full!" };
		}

		this.logger.debug( "<< validatePlayerAddition()" );
		return {};
	}

	/**
	 * Validate initialization inputs for the game.
	 * Checks:
	 * - Game must be in CREATED state
	 * - Player count must be divisible by team count.
	 *
	 * @param input initialization payload.
	 * @returns empty object when valid, otherwise an error description.
	 * @private
	 */
	private validateInitialization( input: CreateGameInput ) {
		this.logger.debug( ">> validateInitialization()" );

		if ( this.data.status !== GAME_STATUS.CREATED ) {
			this.logger.error( "Game has already been initialized!" );
			return { error: "Game has already been initialized!" };
		}

		if ( this.data.playerIds.length > 0 ) {
			this.logger.error( "Cannot initialize a game that already has players!" );
			return { error: "Cannot initialize a game that already has players!" };
		}

		if ( input.playerCount % input.teamCount !== 0 ) {
			this.logger.error( "Invalid team player combination!" );
			return { error: "Invalid team player combination!" };
		}

		this.logger.debug( "<< validateInitialization()" );
		return {};
	}

	/**
	 * Build a per-player snapshot map for broadcasting.
	 * Produces a player-safe view for each player (includes that player's hand but hides global-only secrets).
	 *
	 * @returns mapping of player id to the player-facing snapshot.
	 * @private
	 */
	private getPlayerDataMap() {
		return Object.keys( this.data.players ).reduce(
			( acc, playerId ) => {
				const { hands, cardMappings, ...rest } = this.data;
				acc[ playerId ] = { ...rest, playerId, hand: hands[ playerId ] || [] };
				return acc;
			},
			{} as Record<string, PlayerGameInfo>
		);
	}

	/**
	 * Broadcast the player-facing snapshots to the WSS durable object instance.
	 * Behaviour / side effects:
	 * - Builds a wss id for this game and calls its broadcast method with per-player snapshots.
	 *
	 * @returns void
	 * @private
	 */
	private async broadcastGameData() {
		this.logger.debug( ">> broadcast()" );

		const durableObjectId = this.env.WSS.idFromName( `fish:${ this.data.id }` );
		const wss = this.env.WSS.get( durableObjectId );
		await wss.broadcast( this.getPlayerDataMap() );

		this.logger.debug( "<< broadcast()" );
	}

	/**
	 * Load persisted GameData from storage.
	 * Behaviour:
	 * - Reads the game object from KV and returns it or undefined.
	 *
	 * @returns the persisted game data or undefined if none found.
	 * @private
	 */
	private async loadGameData() {
		return this.env.FISH_KV.get<GameData>( this.key, "json" );
	}

	/**
	 * Persist current GameData into storage.
	 * Side effects:
	 * - Serializes and writes the in-memory data into KV.
	 *
	 * @returns void
	 * @private
	 */
	private async saveGameData() {
		await this.env.FISH_KV.put( this.key, JSON.stringify( this.data ) );
	}

	/**
	 * Persist durable object lookup keys (code and game id) into KV.
	 * Side effects:
	 * - Writes lookup mappings used by external lookup endpoints.
	 *
	 * @returns void
	 * @private
	 */
	private async saveDurableObjectId() {
		await this.env.FISH_KV.put( `code:${ this.data.code }`, this.key );
		await this.env.FISH_KV.put( `gameId:${ this.data.id }`, this.key );
	}
}
