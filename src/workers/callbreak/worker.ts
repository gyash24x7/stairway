import { getCardFromId, getCardId, isCardInHand } from "@/utils/cards";
import { createLogger } from "@/utils/logger";
import type { AuthInfo } from "@/workers/auth/types";
import { engine } from "@/workers/callbreak/engine";
import type {
	CreateGameInput,
	DeclareDealWinsInput,
	GameData,
	GameIdInput,
	JoinGameInput,
	PlayCardInput,
	PlayerGameInfo,
	PlayerId
} from "@/workers/callbreak/types";
import { canCardBePlayed } from "@/workers/callbreak/utils";
import { WorkerEntrypoint } from "cloudflare:workers";

export interface ICallbreakRPC extends WorkerEntrypoint {
	getGameData( input: GameIdInput, authInfo: AuthInfo ): Promise<DataResponse<PlayerGameInfo | undefined>>;

	createGame( input: CreateGameInput, authInfo: AuthInfo ): Promise<DataResponse<GameIdInput>>;

	joinGame( input: JoinGameInput, authInfo: AuthInfo ): Promise<DataResponse<GameIdInput>>;

	declareDealWins( input: DeclareDealWinsInput, authInfo: AuthInfo ): Promise<ErrorResponse>;

	playCard( input: PlayCardInput, authInfo: AuthInfo ): Promise<ErrorResponse>;
}

export default class CallbreakRPC extends WorkerEntrypoint<CallbreakWorkerEnv> implements ICallbreakRPC {

	private readonly logger = createLogger( "Callbreak:RPC" );

	constructor( ctx: ExecutionContext, env: CallbreakWorkerEnv ) {
		super( ctx, env );
	}

	async getGameData( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.loadGameData( input.gameId );
		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error, data: undefined };
		}

		this.logger.debug( "<< getGameData()" );
		return { data: this.getPlayerGameInfo( data, authInfo.id ), error: undefined };
	}

	async createGame( input: CreateGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createGame()" );
		const data = engine.createGame( input, authInfo.id );

		await this.saveGameData( data );
		this.logger.debug( "<< createGame()" );
		return { data: { gameId: data.id }, error: undefined };
	}

	async joinGame( input: JoinGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> joinGame()" );

		const gameId = await this.env.KV.get( `code:${ input.code }` );
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

		this.logger.debug( ">> joinGame()" );
		return { data: { gameId: data.id } };
	}

	async declareDealWins( input: DeclareDealWinsInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> declareDealWins()" );

		let data = await this.loadGameData( input.gameId );
		const { error } = this.validateDealWinDeclaration( input, authInfo );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		data = engine.declareDealWins( input, data );
		await this.saveGameData( data );
		// await this.storage.deleteAlarm();
		// await this.storage.setAlarm( Date.now() + 5000 );

		this.logger.debug( ">> declareDealWins()" );
		return {};
	}

	async playCard( input: PlayCardInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> playCard()" );

		let data = await this.loadGameData( input.gameId );
		const { error } = this.validatePlayCard( input, authInfo );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		data = engine.playCard( input, data );
		await this.saveGameData( data );
		// await this.storage.deleteAlarm();
		// await this.storage.setAlarm( Date.now() + 5000 );

		this.logger.debug( ">> playCard()" );
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
	private validateJoinGame( authInfo: AuthInfo, data?: GameData ): ErrorResponse {
		this.logger.debug( ">> validateJoinGame()" );

		if ( !data ) {
			this.logger.error( "Game Not Found" );
			return { error: "Game not found!" };
		}

		if ( data.players[ authInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", authInfo.id );
			return {};
		}

		if ( Object.keys( data.players ).length >= 4 ) {
			this.logger.error( "Game Full: %s", data.id );
			return { error: "Game full!" };
		}

		this.logger.debug( "<< validateJoinGame()" );
		return {};
	}

	/**
	 * Validates the declaration of deal wins.
	 * Checks if the deal exists, if it has no rounds,
	 * and if it's the player's turn.
	 * If any validation fails, it returns an error.
	 *
	 * @param {DeclareDealWinsInput} input - The input containing deal ID, wins and authInfo
	 * @param {AuthInfo} authInfo - The authentication information of the player.
	 * @param {GameData} data - The GameData to validate action against
	 * @returns {ErrorResponse} - Returns an object containing an error message if any validation fails.
	 */
	private validateDealWinDeclaration(
		input: DeclareDealWinsInput,
		authInfo: AuthInfo,
		data?: GameData
	): ErrorResponse {
		this.logger.debug( ">> validateDealWinDeclaration()" );

		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error };
		}

		if ( data.currentTurn !== authInfo.id ) {
			this.logger.error( "Not Your Turn: %s", authInfo.id );
			return { error: "Not your turn!" };
		}

		const deal = data.deals[ 0 ];
		if ( !deal || deal.rounds.length !== 0 || deal.id !== input.dealId ) {
			this.logger.error( "Active Deal Not Found: %s", data.id );
			return { error: "Active deal not found!" };
		}

		this.logger.debug( "<< validateDealWinDeclaration()" );
		return {};
	}

	/**
	 * Validates the play card action.
	 * Checks if it's the player's turn, if the deal exists,
	 * if the round exists, if the card is in the player's hand,
	 * and if the card can be played according to the game rules.
	 * If any validation fails, it returns an error.
	 *
	 * @param {PlayCardInput} input - The input containing card ID, round ID, deal ID and authInfo
	 * @param {AuthInfo} authInfo - The authentication information of the player.
	 * @param {GameData} data - The GameData to validate action against
	 * @returns {ErrorResponse} - Returns an object containing an error message if any validation fails.
	 */
	private validatePlayCard( input: PlayCardInput, authInfo: AuthInfo, data?: GameData ): ErrorResponse {
		this.logger.debug( ">> validatePlayCard()" );

		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error };
		}

		if ( data.currentTurn !== authInfo.id ) {
			this.logger.error( "Not Your Turn: %s", authInfo.id );
			return { error: "Not your turn!" };
		}

		const deal = data.deals[ 0 ];
		if ( !deal || deal.id !== input.dealId ) {
			this.logger.error( "Deal Not Found: %s", input.dealId );
			return { error: "Deal not found!" };
		}

		const round = deal.rounds[ 0 ];
		if ( !round ) {
			this.logger.error( "Round Not Found: %s", input.roundId );
			return { error: "Round not found!" };
		}

		const hand = deal.hands[ authInfo.id ];
		if ( !isCardInHand( hand, input.cardId ) ) {
			this.logger.error( "Card Not Yours: %s", input.cardId );
			return { error: "Card not in hand!" };
		}

		const cardsPlayedInRound = Object.values( round.cards ).map( getCardFromId );
		const isCardPlayAllowed = canCardBePlayed(
			input.cardId,
			hand,
			data.trump,
			cardsPlayedInRound,
			round.suit
		);

		if ( !isCardPlayAllowed ) {
			this.logger.error( "Invalid Card: %s", input.cardId );
			return { error: "Card cannot be played!" };
		}

		this.logger.debug( "<< validatePlayCard()" );
		return {};
	}

	private validateGameData( authInfo: AuthInfo, data?: GameData ) {
		if ( !data || !data.players[ authInfo.id ] ) {
			this.logger.error( "Game Not Found!", data?.players );
			return { error: "Game not found" };
		}

		return {};
	}

	private async loadGameData( gameId: string ) {
		return this.env.KV.get( gameId )
			.then( d => !!d ? JSON.parse( d ) as GameData : undefined );
	}

	private async saveGameData( data: GameData ) {
		await this.env.KV.put( data.id, JSON.stringify( data ) );
	}

	private async alarm( data: GameData ) {
		this.logger.debug( ">> alarm()" );
		if ( !data ) {
			return;
		}

		switch ( data.status ) {
			case "GAME_CREATED": {
				data = engine.addBots( data );
				await this.saveGameData( data );
				// await this.storage.setAlarm( Date.now() + 5000 );
				break;
			}
			case "PLAYERS_READY": {
				data = engine.createDeal( data );
				await this.saveGameData( data );
				// await this.storage.setAlarm( Date.now() + 5000 );
				break;
			}
			case "CARDS_DEALT": {
				const currentDeal = data.deals[ 0 ];
				const currentPlayer = data.players[ data.currentTurn ];
				if ( currentPlayer.isBot ) {
					const hand = currentDeal.hands[ currentPlayer.id ];
					const wins = engine.suggestDealWins( hand, data.trump );
					const input = { gameId: data.id, dealId: currentDeal.id, wins };
					data = engine.declareDealWins( input, data );
					await this.saveGameData( data );
					// await this.storage.setAlarm( Date.now() + 5000 );
				}
				break;
			}
			case "WINS_DECLARED": {
				data = engine.createRound( data );
				await this.saveGameData( data );
				// await this.storage.setAlarm( Date.now() + 5000 );
				break;
			}
			case "ROUND_STARTED": {
				const currentDeal = data.deals[ 0 ];
				const currentRound = currentDeal.rounds[ 0 ];
				const currentPlayer = data.players[ data.currentTurn ];
				if ( currentPlayer.isBot ) {
					const card = engine.suggestCardToPlay(
						currentDeal.hands[ currentPlayer.id ],
						currentRound,
						Object.values( currentRound.cards ).map( getCardFromId ),
						data.trump
					);
					const input = {
						gameId: data.id,
						dealId: currentDeal.id,
						roundId: currentRound.id,
						cardId: getCardId( card )
					};
					data = engine.playCard( input, data );
					await this.saveGameData( data );
					// await this.storage.setAlarm( Date.now() + 5000 );
				}
				break;
			}
			case "CARDS_PLAYED": {
				data = engine.completeRound( data );
				await this.saveGameData( data );
				// await this.storage.setAlarm( Date.now() + 5000 );
				break;
			}
			case "ROUND_COMPLETED": {
				const currentDeal = data.deals[ 0 ];
				if ( currentDeal.rounds.length === 13 ) {
					data = engine.completeDeal( data );
				} else {
					data = engine.createRound( data );
				}
				await this.saveGameData( data );
				// await this.storage.setAlarm( Date.now() + 5000 );
				break;
			}
			case "DEAL_COMPLETED": {
				if ( data.deals.length < data.dealCount ) {
					data = engine.createDeal( data );
					// await this.storage.setAlarm( Date.now() + 5000 );
				} else {
					data.status = "GAME_COMPLETED";
				}
				await this.saveGameData( data );
				break;
			}
		}

		this.logger.debug( "<< alarm()" );
	}

	private getPlayerGameInfo( { deals, ...rest }: GameData, playerId: PlayerId ): PlayerGameInfo {
		const { rounds, hands, ...currentDeal } = deals[ 0 ];
		return { ...rest, currentDeal, currentRound: rounds[ 0 ], playerId, hand: hands[ playerId ] };
	}
}