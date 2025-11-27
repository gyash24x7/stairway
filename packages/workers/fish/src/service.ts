import type { CardId } from "@s2h/cards/types";
import { isCardInHand } from "@s2h/cards/utils";
import { createLogger } from "@s2h/utils/logger";
import type { FishEngine } from "./engine";
import type {
	AskEventInput,
	BasePlayerInfo,
	ClaimEventInput,
	CreateGameInput,
	CreateTeamsInput,
	GameId,
	JoinGameInput,
	PlayerGameInfo,
	StartGameInput,
	TransferEventInput
} from "./types";
import { GAME_STATUS, getBookForCard } from "./utils";

export class FishService {

	private readonly logger = createLogger( "Fish:Service" );

	constructor(
		private readonly engines: DurableObjectNamespace<FishEngine>,
		private readonly kv: KVNamespace
	) {}

	public async getGameData( gameId: GameId, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> getGameData()" );

		const engine = await this.initializeEngine( gameId, playerInfo.id, async data => {
			if ( !data.players[ playerInfo.id ] ) {
				this.logger.error( "Player Not in Game: %s", playerInfo.id );
				throw "Player not in game!";
			}
		} );

		this.logger.debug( "<< getGameData()" );
		return engine.getPlayerGameInfo( playerInfo.id );
	}

	public async createGame( input: CreateGameInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> createGame()" );

		const durableObjectId = this.engines.newUniqueId();
		const engine = this.engines.get( durableObjectId );
		const { code, gameId } = await engine.updateConfig( input, playerInfo.id );
		await engine.addPlayer( playerInfo );
		await this.saveDurableObjectId( { code, gameId, durableObjectId } );

		this.logger.debug( "<< createGame()" );
		return gameId;
	}

	public async joinGame( input: JoinGameInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> joinGame()" );

		const gameId = await this.getGameIdByCode( input.code );
		if ( !gameId ) {
			this.logger.debug( "Game not found for code %s!", input.code );
			throw "Game not found!";
		}

		const engine = await this.initializeEngine( gameId, playerInfo.id, async data => {
			this.validateJoinGame( playerInfo, data );
		} );

		await engine.addPlayer( playerInfo );

		this.logger.debug( "<< joinGame()" );
		return gameId;
	}

	public async createTeams( input: CreateTeamsInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> createTeams()" );

		const engine = await this.initializeEngine( input.gameId, playerInfo.id, async data => {
			this.validateCreateTeams( input, playerInfo, data );
		} );

		await engine.createTeams( input );
		await engine.setAlarm( 5000 );

		this.logger.debug( "<< createTeams()" );
	}

	public async startGame( input: StartGameInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> startGame()" );

		const engine = await this.initializeEngine( input.gameId, playerInfo.id, async data => {
			this.validateStartGame( playerInfo, data );
		} );

		await engine.startGame( input );
		await engine.setAlarm( 5000 );

		this.logger.debug( "<< startGame()" );
	}

	public async handleAskEvent( input: AskEventInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> handleAskEvent()" );

		const engine = await this.initializeEngine( input.gameId, playerInfo.id, async data => {
			this.validateAskEvent( input, playerInfo, data );
		} );

		await engine.handleAskEvent( input );
		await engine.setAlarm( 5000 );

		this.logger.debug( "<< handleAskEvent()" );
	}

	public async handleClaimEvent( input: ClaimEventInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> handleClaimEvent()" );

		const engine = await this.initializeEngine( input.gameId, playerInfo.id, async data => {
			this.validateClaimEvent( input, playerInfo, data );
		} );

		await engine.handleClaimEvent( input );
		await engine.setAlarm( 5000 );

		this.logger.debug( "<< handleClaimEvent()" );
	}

	public async handleTransferEvent( input: TransferEventInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> handleTransferEvent()" );

		const engine = await this.initializeEngine( input.gameId, playerInfo.id, async data => {
			this.validateTransferEvent( input, playerInfo, data );
		} );

		await engine.handleTransferEvent( input );
		await engine.setAlarm( 5000 );

		this.logger.debug( "<< handleTransferEvent()" );
	}

	/**
	 * Suggests possible ask actions for the current player based on their hand and the game state.
	 * @param playerInfo - The authentication information of the player for whom to suggest asks.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in progress or if it's not the player's turn.
	 * @private
	 */
	private validateJoinGame( playerInfo: BasePlayerInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateJoinGame()" );

		if ( data.players[ playerInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", playerInfo.id );
			return;
		}

		if ( data.playerIds.length >= data.config.playerCount ) {
			this.logger.error( "Game Full: %s", data.id );
			throw "Game full!";
		}

		this.logger.debug( "<< validateJoinGame()" );
	}

	/**
	 * Validates the input for creating teams, ensuring that the game state and player assignments are correct.
	 * @param input - The input containing team names and their respective player IDs.
	 * @param playerInfo - The authentication information of the player creating the teams.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in the correct state or if the team assignments are invalid.
	 * @private
	 */
	private validateCreateTeams( input: CreateTeamsInput, playerInfo: BasePlayerInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateCreateTeams()" );

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== playerInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, playerInfo.id );
			throw "Not your turn!";
		}

		if ( data.status !== GAME_STATUS.PLAYERS_READY ) {
			this.logger.error( "The Game is not in PLAYERS_READY state! GameId: %s", data.id );
			throw "The Game is not in PLAYERS_READY state!";
		}

		if ( data.playerIds.length !== data.config.playerCount ) {
			this.logger.error( "The Game does not have required players! GameId: %s", data.id );
			throw "The Game does not have required players!";
		}

		const playersSpecified = new Set( Object.values( input.data ).flat() );
		if ( playersSpecified.size !== data.config.playerCount ) {
			this.logger.error( "Not all players are divided into teams! GameId: %s", data.id );
			throw "Not all players are divided into teams!";
		}

		const teamCount = Object.keys( input.data ).length;
		const playersPerTeam = data.config.playerCount / teamCount;
		for ( const [ teamId, playerIds ] of Object.entries( input.data ) ) {
			if ( playerIds.length !== playersPerTeam ) {
				this.logger.error(
					"The number of players in team does not match the required count! GameId: %s",
					data.id
				);
				throw `The number of players in team ${ teamId } does not match the required count!`;
			}

			for ( const playerId of playerIds ) {
				if ( !data.players[ playerId ] ) {
					this.logger.error( "Player %s is not part of the game! GameId: %s", playerId, data.id );
					throw `Player ${ playerId } is not part of the game!`;
				}
			}
		}

		this.logger.debug( "<< validateCreateTeams()" );
	}

	/**
	 * Validates the conditions required to start the game, ensuring that the game state
	 * and player turn are appropriate.
	 * @param playerInfo - The authentication information of the player starting the game.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in the correct state or if it's not the player's turn.
	 * @private
	 */
	private validateStartGame( playerInfo: BasePlayerInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateStartGame()" );

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== playerInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, playerInfo.id );
			throw "Not your turn!";
		}

		if ( data.status !== GAME_STATUS.TEAMS_CREATED ) {
			this.logger.error( "The Game is not in TEAMS_CREATED state! GameId: %s", data.id );
			throw "The Game is not in TEAMS_CREATED state!";
		}

		this.logger.debug( "<< validateStartGame()" );
	}

	/**
	 * Validates the conditions required for a player to ask another player for a card,
	 * ensuring that the game state and player turn are appropriate.
	 * @param event - The ask event input containing details of the ask action.
	 * @param playerInfo - The authentication information of the player making the ask.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in progress, if it's not the player's turn,
	 * or if the ask action is invalid. Asked player must be from opposing team and
	 * the asking player must not have the asked card in their hand.
	 * @private
	 */
	private validateAskEvent( event: AskEventInput, playerInfo: BasePlayerInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateAskEvent()" );

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== playerInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, playerInfo.id );
			throw "Not your turn!";
		}

		if ( data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.id );
			throw "The Game is not in IN_PROGRESS state!";
		}

		if ( !data.players[ event.from ] ) {
			this.logger.error( "Asked player %s is not part of the game! GameId: %s", event.from, data.id );
			throw `Asked player ${ event.from } is not part of the game!` ;
		}

		const book = getBookForCard( event.cardId, data.config.type );
		if ( !data.bookStates[ book ] ) {
			this.logger.error( "Card %s does not exist in the game! GameId: %s", event.cardId, data.id );
			throw `Card ${ event.cardId } does not exist in the game!` ;
		}

		if ( isCardInHand( data.hand, event.cardId ) ) {
			this.logger.debug( "The asked card is with asking player itself! GameId: %s", data.id );
			throw "The asked card is with asking player itself!";
		}

		const askingPlayerTeam = data.teams[ data.players[ playerInfo.id ].teamId ];
		const askedPlayerTeam = data.teams[ data.players[ event.from ].teamId ];
		if ( askedPlayerTeam === askingPlayerTeam ) {
			this.logger.debug( "The asked player is from the same team! GameId: %s", data.id );
			throw "The asked player is from the same team!";
		}

		this.logger.debug( "<< validateAskEvent()" );
	}

	/**
	 * Validates the conditions required for a player to make a claim,
	 * ensuring that the game state and player turn are appropriate.
	 * @param event - The claim event input containing details of the claim action.
	 * @param playerInfo - The authentication information of the player making the claim.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in progress, if it's not the player's turn,
	 * or if the claim action is invalid. Claim must be for all cards of a book and
	 * must include the claiming player. Cards must be from the same book and
	 * must be claimed for players from the same team.
	 * @private
	 */
	private validateClaimEvent( event: ClaimEventInput, playerInfo: BasePlayerInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateClaimEvent()" );

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== playerInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, playerInfo.id );
			throw "Not your turn!";
		}

		if ( data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.id );
			throw "The Game is not in IN_PROGRESS state!";
		}

		const calledCards = Object.keys( event.claim ).map( key => key as CardId );

		if ( data.config.type === "NORMAL" && calledCards.length !== 4 ) {
			this.logger.error( "Normal Fish requires exactly 4 cards to be declared! GameId: %s", data.id );
			throw "Normal Fish requires exactly 4 cards to be declared!";
		}

		if ( data.config.type === "CANADIAN" && calledCards.length !== 6 ) {
			this.logger.error( "Canadian Fish requires exactly 6 cards to be declared! GameId: %s", data.id );
			throw "Canadian Fish requires exactly 6 cards to be declared!";
		}

		for ( const pid of Object.values( event.claim ) ) {
			if ( !data.players[ pid ] ) {
				this.logger.error( "Player %s is not part of the game! GameId: %s", pid, data.id );
				throw `Player ${ pid } is not part of the game!` ;
			}
		}

		if ( !Object.values( event.claim ).includes( playerInfo.id ) ) {
			this.logger.error( "Calling Player did not call own cards! UserId: %s", playerInfo.id );
			throw "Calling Player did not call own cards!";
		}

		const calledBooks = new Set( calledCards.map( cardId => getBookForCard( cardId, data.config.type ) ) );
		if ( calledBooks.size !== 1 ) {
			this.logger.error( "Cards Called from multiple books! UserId: %s", data.currentTurn );
			throw "Cards Called from multiple books!";
		}

		const calledTeams = new Set( Object.values( event.claim ).map( pid => data.players[ pid ].teamId ) );
		if ( calledTeams.size !== 1 ) {
			this.logger.error( "Set called from multiple teams! UserId: %s", data.currentTurn );
			throw "Set called from multiple teams!";
		}

		this.logger.debug( "<< validateClaimEvent()" );
	}

	/**
	 * Validates the conditions required for a player to transfer their turn to a teammate,
	 * ensuring that the game state and player turn are appropriate.
	 * @param event - The transfer event input containing details of the transfer action.
	 * @param playerInfo - The authentication information of the player making the transfer.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in progress, if it's not the player's turn,
	 * or if the transfer action is invalid. Transfer can only be made after a successful claim
	 * to a player with cards from the same team.
	 * @private
	 */
	private validateTransferEvent( event: TransferEventInput, playerInfo: BasePlayerInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateTransferTurnRequest()" );

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== playerInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, playerInfo.id );
			throw "Not your turn!";
		}

		if ( data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.id );
			throw "The Game is not in IN_PROGRESS state!";
		}

		const lastClaim = data.claimHistory[ 0 ];
		if ( data.lastMoveType !== "claim" || !lastClaim || !lastClaim.success ) {
			this.logger.error( "Turn can only be transferred after a successful call!" );
			throw "Turn can only be transferred after a successful call!";
		}

		const transferringPlayer = data.players[ data.currentTurn ];
		const receivingPlayer = data.players[ event.transferTo ];

		if ( !receivingPlayer ) {
			this.logger.error( "The Receiving Player is not part of the Game!" );
			throw "The Receiving Player is not part of the Game!";
		}

		if ( data.cardCounts[ event.transferTo ] === 0 ) {
			this.logger.error( "Turn can only be transferred to a player with cards!" );
			throw "Turn can only be transferred to a player with cards!";
		}

		if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
			this.logger.error( "Turn can only be transferred to member of your team!" );
			throw "Turn can only be transferred to member of your team!";
		}

		this.logger.debug( "<< validateTransferTurnRequest()" );
	}

	private async initializeEngine(
		gameId: string,
		playerId: string,
		runChecks?: ( data: PlayerGameInfo ) => Promise<void>
	) {
		const durableObjectId = await this.getDurableObjectIdByGameId( gameId );
		if ( !durableObjectId ) {
			this.logger.debug( "Game not found!" );
			throw "Game not found!";
		}

		const engine = this.engines.get( durableObjectId );
		const data = await engine.getPlayerGameInfo( playerId );

		if ( runChecks ) {
			runChecks( data ).catch( error => {
				this.logger.error( "Error during checks:", error );
				throw ( error as Error ).message;
			} );
		}

		return engine;
	}

	private async getGameIdByCode( code: string ) {
		return this.kv.get( `code:${ code }` );
	}

	private async getDurableObjectIdByGameId( gameId: string ) {
		const id = await this.kv.get( `gameId:${ gameId }` );
		return !id ? undefined : this.engines.idFromString( id );
	}

	private async saveDurableObjectId( data: { code: string, durableObjectId: DurableObjectId, gameId: string } ) {
		await this.kv.put( `code:${ data.code }`, data.durableObjectId.toString() );
		await this.kv.put( `gameId:${ data.gameId }`, data.durableObjectId.toString() );
	}
}
