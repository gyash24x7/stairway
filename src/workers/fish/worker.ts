import { chunk } from "@/utils/array";
import type { CardId } from "@/utils/cards";
import { getCardFromId, isCardInHand } from "@/utils/cards";
import { generateTeamName } from "@/utils/generator";
import { createLogger } from "@/utils/logger";
import type { AuthInfo } from "@/workers/auth/types";
import { engine } from "@/workers/fish/engine";
import type {
	AskEventInput,
	ClaimEventInput,
	CreateGameInput,
	CreateTeamsInput,
	GameConfig,
	GameData,
	GameIdInput,
	JoinGameInput,
	PlayerGameInfo,
	PlayerId,
	StartGameInput,
	TeamCount,
	TransferEventInput
} from "@/workers/fish/types";
import { GAME_STATUS, getBookForCard } from "@/workers/fish/utils";
import { WorkerEntrypoint } from "cloudflare:workers";

export interface IFishRPC extends WorkerEntrypoint {
	getGameData( input: GameIdInput, authInfo: AuthInfo ): Promise<DataResponse<PlayerGameInfo | undefined>>;

	createGame( input: CreateGameInput, authInfo: AuthInfo ): Promise<DataResponse<GameIdInput>>;

	joinGame( input: JoinGameInput, authInfo: AuthInfo ): Promise<DataResponse<GameIdInput>>;

	createTeams( input: CreateTeamsInput, authInfo: AuthInfo ): Promise<ErrorResponse>;

	startGame( input: StartGameInput, authInfo: AuthInfo ): Promise<ErrorResponse>;

	askCard( input: AskEventInput, authInfo: AuthInfo ): Promise<ErrorResponse>;

	claimBook( input: ClaimEventInput, authInfo: AuthInfo ): Promise<ErrorResponse>;

	transferTurn( input: TransferEventInput, authInfo: AuthInfo ): Promise<ErrorResponse>;
}

export default class FishRPC extends WorkerEntrypoint<FishWorkerEnv> implements IFishRPC {

	private readonly logger = createLogger( "Fish:RPC" );

	constructor( ctx: ExecutionContext, env: FishWorkerEnv ) {
		super( ctx, env );
	}

	async getGameData( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.loadGameData( input.gameId );
		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error };
		}

		this.logger.debug( "<< getGameData()" );
		return { data: this.getPlayerGameInfo( data, authInfo.id ) };
	}

	async createGame( input: CreateGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createGame()" );

		const config: GameConfig = {
			type: "NORMAL",
			playerCount: input.playerCount ?? 6,
			teamCount: 2,
			books: [],
			deckType: 48
		};

		const data = engine.createGame( config, authInfo.id );
		await this.saveGameData( data );

		this.logger.debug( "<< createGame()" );
		return { data: { gameId: data.id }, error: undefined };
	}

	async joinGame( input: JoinGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> joinGame()" );

		const gameId = await this.env.FISH_KV.get( `code:${ input.code }` );
		if ( !gameId ) {
			this.logger.debug( "Game not found for code %s!", input.code );
			return { error: "Game not found!" };
		}

		let data = await this.loadGameData( gameId );
		const { error } = this.validateJoinGame( authInfo );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		data = engine.addPlayer( data, authInfo );
		await this.saveGameData( data );
		if ( data.status === "PLAYERS_READY" ) {
			// await this.storage.deleteAlarm();
			// await this.storage.setAlarm( Date.now() + 5000 );
		}

		this.logger.debug( "<< joinGame()" );
		return { data: { gameId: data.id } };
	}

	async createTeams( input: CreateTeamsInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createTeams()" );

		let data = await this.loadGameData( input.gameId );
		const { error } = this.validateCreateTeams( input, authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		data = engine.createTeams( input, data );
		await this.saveGameData( data );
		// await this.storage.deleteAlarm();
		// await this.storage.setAlarm( Date.now() + 5000 );

		this.logger.debug( "<< createTeams()" );
		return {};
	}

	async startGame( input: StartGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> startGame()" );

		let data = await this.loadGameData( input.gameId );
		const { error } = this.validateStartGame( authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		data = engine.startGame( input, data );
		await this.saveGameData( data );
		// await this.storage.deleteAlarm();
		// await this.storage.setAlarm( Date.now() + 5000 );

		this.logger.debug( "<< startGame()" );
		return {};
	}

	async askCard( input: AskEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> askCard()" );

		let data = await this.loadGameData( input.gameId );
		const { error } = this.validateAskEvent( input, authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		data = engine.handleAskEvent( input, data );
		await this.saveGameData( data );
		// await this.storage.deleteAlarm();
		// await this.storage.setAlarm( Date.now() + 5000 );

		this.logger.debug( "<< askCard()" );
		return {};
	}

	async claimBook( input: ClaimEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> claimBook()" );

		let data = await this.loadGameData( input.gameId );
		const { error } = this.validateClaimEvent( input, authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		data = engine.handleClaimEvent( input, data );
		await this.saveGameData( data );
		// await this.storage.deleteAlarm();
		// await this.storage.setAlarm( Date.now() + 5000 );

		this.logger.debug( "<< claimBook()" );
		return {};
	}

	async transferTurn( input: TransferEventInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> transferTurn()" );

		let data = await this.loadGameData( input.gameId );
		const { error } = this.validateTransferEvent( input, authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		data = engine.handleTransferEvent( input, data );
		await this.saveGameData( data );
		// await this.storage.deleteAlarm();
		// await this.storage.setAlarm( Date.now() + 5000 );

		this.logger.debug( "<< transferTurn()" );
		return {};
	}

	private validateGameData( authInfo: AuthInfo, data?: GameData ) {
		if ( !data || !data.players[ authInfo.id ] ) {
			this.logger.error( "Game Not Found!" );
			return { error: "Game not found" };
		}

		return {};
	}

	/**
	 * Validates the join game request.
	 * Checks if the game exists, if the player is already in the game,
	 * and if the game is full.
	 * If any validation fails, it returns an error.
	 *
	 * @param {AuthInfo} authInfo - The authentication information of the player.
	 * @param {GameData} data - The GameData to validate action against
	 * @returns {ErrorResponse} - Returns an object containing an error message if any validation fails.
	 */
	private validateJoinGame( authInfo: AuthInfo, data?: GameData ): { error?: string } {
		this.logger.debug( ">> validateJoinGame()" );

		if ( !data ) {
			this.logger.error( "Game Not Found" );
			return { error: "Game not found!" };
		}

		if ( data.players[ authInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", authInfo.id );
			return {};
		}

		if ( Object.keys( data.players ).length >= data.config.playerCount ) {
			this.logger.error( "Game Full: %s", data.id );
			return { error: "Game full!" };
		}

		this.logger.debug( "<< validateJoinGame()" );
		return {};
	}

	private validateCreateTeams( input: CreateTeamsInput, authInfo: AuthInfo, data?: GameData ) {
		this.logger.debug( ">> validateCreateTeams()" );

		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, authInfo.id );
			return { error: "Not your turn!" };
		}

		if ( data.status !== GAME_STATUS.PLAYERS_READY ) {
			this.logger.error( "The Game is not in PLAYERS_READY state! GameId: %s", data.id );
			return { error: "The Game is not in PLAYERS_READY state!" };
		}

		if ( data.playerIds.length !== data.config.playerCount ) {
			this.logger.error( "The Game does not have required players! GameId: %s", data.id );
			return { error: "The Game does not have required players!" };
		}

		const playersSpecified = new Set( Object.values( input.data ).flat() );
		if ( playersSpecified.size !== data.config.playerCount ) {
			this.logger.error( "Not all players are divided into teams! GameId: %s", data.id );
			return { error: "Not all players are divided into teams!" };
		}

		const teamCount = Object.keys( input.data ).length;
		const playersPerTeam = data.config.playerCount / teamCount;
		for ( const [ teamId, playerIds ] of Object.entries( input.data ) ) {
			if ( playerIds.length !== playersPerTeam ) {
				this.logger.error(
					"The number of players in team does not match the required count! GameId: %s",
					data.id
				);
				return { error: `The number of players in team ${ teamId } does not match the required count!` };
			}

			for ( const playerId of playerIds ) {
				if ( !data.players[ playerId ] ) {
					this.logger.error( "Player %s is not part of the game! GameId: %s", playerId, data.id );
					return { error: `Player ${ playerId } is not part of the game!` };
				}
			}
		}

		this.logger.debug( "<< validateCreateTeams()" );
		return {};
	}

	private validateStartGame( authInfo: AuthInfo, data?: GameData ) {
		this.logger.debug( ">> validateStartGame()" );

		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, authInfo.id );
			return { error: "Not your turn!" };
		}

		if ( data.status !== GAME_STATUS.TEAMS_CREATED ) {
			this.logger.error( "The Game is not in TEAMS_CREATED state! GameId: %s", data.id );
			return { error: "The Game is not in TEAMS_CREATED state!" };
		}

		this.logger.debug( "<< validateStartGame()" );
		return {};
	}

	private validateAskEvent( event: AskEventInput, authInfo: AuthInfo, data?: GameData ) {
		this.logger.debug( ">> validateAskEvent()" );

		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, authInfo.id );
			return { error: "Not your turn!" };
		}

		const currentPlayerHand = data.hands[ data.currentTurn ];

		if ( data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.id );
			return { error: "The Game is not in IN_PROGRESS state!" };
		}

		if ( !data.players[ event.from ] ) {
			this.logger.error( "Asked player %s is not part of the game! GameId: %s", event.from, data.id );
			return { error: `Asked player ${ event.from } is not part of the game!` };
		}

		const book = getBookForCard( event.cardId, data.config.type );
		if ( !data.bookStates[ book ] ) {
			this.logger.error( "Card %s does not exist in the game! GameId: %s", event.cardId, data.id );
			return { error: `Card ${ event.cardId } does not exist in the game!` };
		}

		if ( isCardInHand( currentPlayerHand.map( getCardFromId ), event.cardId ) ) {
			this.logger.debug( "The asked card is with asking player itself! GameId: %s", data.id );
			return { error: "The asked card is with asking player itself!" };
		}

		const askingPlayerTeam = data.teams[ data.players[ authInfo.id ].teamId ];
		const askedPlayerTeam = data.teams[ data.players[ event.from ].teamId ];
		if ( askedPlayerTeam === askingPlayerTeam ) {
			this.logger.debug( "The asked player is from the same team! GameId: %s", data.id );
			return { error: "The asked player is from the same team!" };
		}

		this.logger.debug( "<< validateAskEvent()" );
		return {};
	}

	private validateClaimEvent( event: ClaimEventInput, authInfo: AuthInfo, data?: GameData ) {
		this.logger.debug( ">> validateDeclareBookEvent()" );

		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, authInfo.id );
			return { error: "Not your turn!" };
		}

		if ( data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.id );
			return { error: "The Game is not in IN_PROGRESS state!" };
		}

		const calledCards = Object.keys( event.claim ).map( key => key as CardId );

		if ( data.config.type === "NORMAL" && calledCards.length !== 4 ) {
			this.logger.error( "Normal Fish requires exactly 4 cards to be declared! GameId: %s", data.id );
			return { error: "Normal Fish requires exactly 4 cards to be declared!" };
		}

		if ( data.config.type === "CANADIAN" && calledCards.length !== 6 ) {
			this.logger.error( "Canadian Fish requires exactly 6 cards to be declared! GameId: %s", data.id );
			return { error: "Canadian Fish requires exactly 6 cards to be declared!" };
		}

		for ( const pid of Object.values( event.claim ) ) {
			if ( !data.players[ pid ] ) {
				this.logger.error( "Player %s is not part of the game! GameId: %s", pid, data.id );
				return { error: `Player ${ pid } is not part of the game!` };
			}
		}

		if ( !Object.values( event.claim ).includes( authInfo.id ) ) {
			this.logger.error( "Calling Player did not call own cards! UserId: %s", authInfo.id );
			return { error: "Calling Player did not call own cards!" };
		}

		const calledBooks = calledCards.map( cardId => getBookForCard( cardId, data.config.type ) );
		if ( calledBooks.length !== 1 ) {
			this.logger.error( "Cards Called from multiple books! UserId: %s", data.currentTurn );
			return { error: "Cards Called from multiple books!" };
		}

		const calledTeams = new Set( Object.values( event.claim ).map( pid => data.players[ pid ].teamId ) );
		if ( calledTeams.size !== 1 ) {
			this.logger.error( "Set called from multiple teams! UserId: %s", data.currentTurn );
			return { error: "Set called from multiple teams!" };
		}

		this.logger.debug( "<< validateDeclareBookEvent()" );
		return {};
	}

	private validateTransferEvent( event: TransferEventInput, authInfo: AuthInfo, data?: GameData ) {
		this.logger.debug( ">> validateTransferTurnRequest()" );

		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		const currentPlayer = data.players[ data.currentTurn ];
		if ( !currentPlayer || currentPlayer.id !== authInfo.id ) {
			this.logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, authInfo.id );
			return { error: "Not your turn!" };
		}

		if ( data.status !== GAME_STATUS.IN_PROGRESS ) {
			this.logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.id );
			return { error: "The Game is not in IN_PROGRESS state!" };
		}

		const lastClaim = data.claimHistory[ 0 ];
		if ( data.lastMoveType !== "claim" || !lastClaim || !lastClaim.success ) {
			this.logger.error( "Turn can only be transferred after a successful call!" );
			return { error: "Turn can only be transferred after a successful call!" };
		}

		const transferringPlayer = data.players[ data.currentTurn ];
		const receivingPlayer = data.players[ event.transferTo ];

		if ( !receivingPlayer ) {
			this.logger.error( "The Receiving Player is not part of the Game!" );
			return { error: "The Receiving Player is not part of the Game!" };
		}

		if ( data.cardCounts[ event.transferTo ] === 0 ) {
			this.logger.error( "Turn can only be transferred to a player with cards!" );
			return { error: "Turn can only be transferred to a player with cards!" };
		}

		if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
			this.logger.error( "Turn can only be transferred to member of your team!" );
			return { error: "Turn can only be transferred to member of your team!" };
		}

		this.logger.debug( "<< validateTransferTurnRequest()" );
		return {};
	}

	private async loadGameData( gameId: string ) {
		return this.env.FISH_KV.get( gameId )
			.then( d => !!d ? JSON.parse( d ) as GameData : undefined );
	}

	private async saveGameData( data: GameData ) {
		await this.env.FISH_KV.put( data.id, JSON.stringify( data ) );
	}

	private async alarm( data: GameData ) {
		this.logger.debug( ">> alarm()" );
		if ( !data ) {
			return;
		}

		switch ( data.status ) {
			case "CREATED": {
				data = engine.addBots( data );
				await this.saveGameData( data );
				// await this.storage.deleteAlarm();
				// await this.storage.setAlarm( Date.now() + 5000 );
				break;
			}
			case "PLAYERS_READY": {
				const teamData = this.getDefaultTeamData( data.config.teamCount, data.playerIds );
				data = engine.createTeams( { gameId: data.id, data: teamData }, data );
				await this.saveGameData( data );
				// await this.storage.deleteAlarm();
				// await this.storage.setAlarm( Date.now() + 5000 );
				break;
			}
			case "TEAMS_CREATED": {
				const input: StartGameInput = { type: "NORMAL", deckType: 48, gameId: data.id };
				data = engine.startGame( input, data );
				await this.saveGameData( data );
				// await this.storage.deleteAlarm();
				// await this.storage.setAlarm( Date.now() + 5000 );
				break;
			}
			case "IN_PROGRESS": {
				const currentPlayer = data.players[ data.currentTurn ];
				if ( currentPlayer.isBot ) {
					const playerGameInfo = this.getPlayerGameInfo( data, data.currentTurn );
					const weightedBooks = engine.suggestBooks( playerGameInfo );

					const isLastMoveSuccessfulClaim = data.lastMoveType === "claim"
						&& data.claimHistory[ 0 ]?.success
						&& data.claimHistory[ 0 ]?.playerId === data.currentTurn;

					if ( isLastMoveSuccessfulClaim ) {
						const weightedTransfers = engine.suggestTransfers( weightedBooks, playerGameInfo );
						if ( weightedTransfers.length > 0 ) {
							const transferTo = weightedTransfers[ 0 ].transferTo;
							this.logger.info( "Bot %s transferring turn to %s", currentPlayer.id, transferTo );
							const input: TransferEventInput = { gameId: data.id, transferTo };
							data = engine.handleTransferEvent( input, data );
							await this.saveGameData( data );
							// await this.storage.deleteAlarm();
							// await this.storage.setAlarm( Date.now() + 5000 );
							break;
						}
					}

					this.logger.info( "Bot %s skipping transfer!", currentPlayer.id );

					const weightedClaims = engine.suggestClaims( weightedBooks, playerGameInfo );
					if ( weightedClaims.length > 0 ) {
						const claim = weightedClaims[ 0 ].claim;
						this.logger.info( "Bot %s claiming book with cards: %o", currentPlayer.id, claim );
						const input: ClaimEventInput = { gameId: data.id, claim };
						data = engine.handleClaimEvent( input, data );
						await this.saveGameData( data );
						// await this.storage.deleteAlarm();
						// await this.storage.setAlarm( Date.now() + 5000 );
						break;
					}

					this.logger.info( "Bot %s skipping claim!", currentPlayer.id );

					const weightedAsks = engine.suggestAsks( weightedBooks, playerGameInfo );
					if ( weightedAsks.length > 0 ) {
						const { playerId, cardId } = weightedAsks[ 0 ];
						this.logger.info( "Bot %s asking %s for card %s", currentPlayer.id, playerId, cardId );
						const event: AskEventInput = { gameId: data.id, from: playerId, cardId };
						data = engine.handleAskEvent( event, data );
						await this.saveGameData( data );
						// await this.storage.deleteAlarm();
						// await this.storage.setAlarm( Date.now() + 5000 );
						break;
					}

					this.logger.info( "No Valid move found for bot %s!", currentPlayer.id );
				}
				break;
			}
			case "COMPLETED": {
				// await this.storage.deleteAlarm();
				break;
			}
		}

		this.logger.debug( "<< alarm()" );
	}

	private getPlayerGameInfo( { hands, cardMappings, ...rest }: GameData, playerId: PlayerId ) {
		return { ...rest, playerId, hand: hands[ playerId ].map( getCardFromId ) || [] };
	}

	private getDefaultTeamData( teamCount: TeamCount, players: PlayerId[] ) {
		const names = Array( teamCount ).fill( 0 ).map( () => generateTeamName() );
		const groups = chunk( players, players.length / teamCount );
		return names.reduce(
			( acc, name, idx ) => {
				acc[ name ] = groups[ idx ];
				return acc;
			},
			{} as Record<string, PlayerId[]>
		);
	}
}