import type { AuthInfo } from "@/auth/types";
import type {
	AskEventInput,
	ClaimEventInput,
	CreateGameInput,
	CreateTeamsInput,
	GameIdInput,
	JoinGameInput,
	PlayerGameInfo,
	StartGameInput,
	TransferEventInput
} from "@/fish/types";
import { GAME_STATUS, getBookForCard } from "@/fish/utils";
import type { FishDO } from "@/fish/worker/durable.object";
import { type CardId, isCardInHand } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import { ORPCError } from "@orpc/server";
import { env } from "cloudflare:workers";

export class FishService {

	private readonly logger = createLogger( "Fish:Service" );

	public async getGameData( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.initializeStub( input.gameId, async stub => {
			const { data } = await stub.getPlayerData( authInfo.id );

			if ( !data.players[ authInfo.id ] ) {
				this.logger.error( "Player Not in Game: %s", authInfo.id );
				throw new ORPCError( "FORBIDDEN", { message: "Player not in game!" } );
			}

			return data;
		} );

		this.logger.debug( "<< getGameData()" );
		return data;
	}

	public async createGame( input: CreateGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createGame()" );

		const durableObjectId = env.FISH_DO.newUniqueId();
		const stub = env.FISH_DO.get( durableObjectId );
		await stub.initialize( { ...input, authInfo } );
		const { data } = await stub.getPlayerData( authInfo.id );
		await this.saveDurableObjectId( { code: data.code, gameId: data.id, durableObjectId } );

		this.logger.debug( "<< createGame()" );
		return { gameId: data.id };
	}

	public async joinGame( input: JoinGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> joinGame()" );

		const gameId = await this.getGameIdByCode( input.code );
		if ( !gameId ) {
			this.logger.debug( "Game not found for code %s!", input.code );
			throw new ORPCError( "BAD_REQUEST", { message: "Game not found!" } );
		}

		await this.initializeStub( gameId, async stub => {
			const { data } = await stub.getPlayerData( authInfo.id );
			this.validateJoinGame( authInfo, data );
			await stub.addPlayer( authInfo );
		} );

		this.logger.debug( "<< joinGame()" );
		return { gameId };
	}

	public async createTeams( input: CreateTeamsInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createTeams()" );

		await this.initializeStub( input.gameId, async stub => {
			const { data } = await stub.getPlayerData( authInfo.id );
			this.validateCreateTeams( input, authInfo, data );
			await stub.createTeams( input );
		} );

		this.logger.debug( "<< createTeams()" );
	}

	public async startGame( input: StartGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> startGame()" );

		await this.initializeStub( input.gameId, async stub => {
			const { data } = await stub.getPlayerData( authInfo.id );
			this.validateStartGame( authInfo, data );
			await stub.startGame( input );
		} );

		this.logger.debug( "<< startGame()" );
	}

	public async handleAskEvent( input: AskEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> handleAskEvent()" );

		await this.initializeStub( input.gameId, async stub => {
			const { data } = await stub.getPlayerData( authInfo.id );
			this.validateAskEvent( input, authInfo, data );
			await stub.handleAskEvent( input );
		} );

		this.logger.debug( "<< handleAskEvent()" );
	}

	public async handleClaimEvent( input: ClaimEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> handleClaimEvent()" );

		await this.initializeStub( input.gameId, async stub => {
			const { data } = await stub.getPlayerData( authInfo.id );
			this.validateClaimEvent( input, authInfo, data );
			await stub.handleClaimEvent( input );
		} );

		this.logger.debug( "<< handleClaimEvent()" );
	}

	public async handleTransferEvent( input: TransferEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> handleTransferEvent()" );

		await this.initializeStub( input.gameId, async stub => {
			const { data } = await stub.getPlayerData( authInfo.id );
			this.validateTransferEvent( input, authInfo, data );
			await stub.handleTransferEvent( input );
		} );

		this.logger.debug( "<< handleTransferEvent()" );
	}

	private async initializeStub<T = void>(
		gameId: string,
		consumer: ( stub: DurableObjectStub<FishDO> ) => Promise<T>
	) {
		const durableObjectId = await this.getDurableObjectIdByGameId( gameId );
		if ( !durableObjectId ) {
			this.logger.debug( "Game not found for gameId %s!", gameId );
			throw new ORPCError( "BAD_REQUEST", { message: "Game not found!" } );
		}

		const stub = env.FISH_DO.get( durableObjectId );
		return consumer( stub ).catch( error => {
			this.logger.error( "Error during checks:", error );
			throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
		} );
	}

	/**
	 * Suggests possible ask actions for the current player based on their hand and the game state.
	 * @param authInfo - The authentication information of the player for whom to suggest asks.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in progress or if it's not the player's turn.
	 * @private
	 */
	private validateJoinGame( authInfo: AuthInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateJoinGame()" );

		if ( data.players[ authInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", authInfo.id );
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
	 * @param authInfo - The authentication information of the player creating the teams.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in the correct state or if the team assignments are invalid.
	 * @private
	 */
	private validateCreateTeams( input: CreateTeamsInput, authInfo: AuthInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateCreateTeams()" );

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, authInfo.id );
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
	 * @param authInfo - The authentication information of the player starting the game.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in the correct state or if it's not the player's turn.
	 * @private
	 */
	private validateStartGame( authInfo: AuthInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateStartGame()" );

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, authInfo.id );
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
	 * @param authInfo - The authentication information of the player making the ask.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in progress, if it's not the player's turn,
	 * or if the ask action is invalid. Asked player must be from opposing team and
	 * the asking player must not have the asked card in their hand.
	 * @private
	 */
	private validateAskEvent( event: AskEventInput, authInfo: AuthInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateAskEvent()" );

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, authInfo.id );
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

		const askingPlayerTeam = data.teams[ data.players[ authInfo.id ].teamId ];
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
	 * @param authInfo - The authentication information of the player making the claim.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in progress, if it's not the player's turn,
	 * or if the claim action is invalid. Claim must be for all cards of a book and
	 * must include the claiming player. Cards must be from the same book and
	 * must be claimed for players from the same team.
	 * @private
	 */
	private validateClaimEvent( event: ClaimEventInput, authInfo: AuthInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateClaimEvent()" );

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, authInfo.id );
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

		if ( !Object.values( event.claim ).includes( authInfo.id ) ) {
			this.logger.error( "Calling Player did not call own cards! UserId: %s", authInfo.id );
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
	 * @param authInfo - The authentication information of the player making the transfer.
	 * @param data - The current game data for player.
	 * @throws {Error} error if the game is not in progress, if it's not the player's turn,
	 * or if the transfer action is invalid. Transfer can only be made after a successful claim
	 * to a player with cards from the same team.
	 * @private
	 */
	private validateTransferEvent( event: TransferEventInput, authInfo: AuthInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateTransferTurnRequest()" );

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, authInfo.id );
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

	private async getGameIdByCode( code: string ) {
		return env.FISH_KV.get( `code:${ code }` );
	}

	private async getDurableObjectIdByGameId( gameId: string ) {
		const id = await env.FISH_KV.get( `gameId:${ gameId }` );
		return !id ? undefined : env.FISH_DO.idFromString( id );
	}

	private async saveDurableObjectId( data: { code: string, durableObjectId: DurableObjectId, gameId: string } ) {
		await env.FISH_KV.put( `code:${ data.code }`, data.durableObjectId.toString() );
		await env.FISH_KV.put( `gameId:${ data.gameId }`, data.durableObjectId.toString() );
	}
}

export const service = new FishService();