import type { AuthInfo } from "@/auth/types";
import type {
	CreateGameInput,
	DeclareDealWinsInput,
	GameIdInput,
	JoinGameInput,
	PlayCardInput,
	PlayerGameInfo
} from "@/callbreak/types";
import { canCardBePlayed } from "@/callbreak/utils";
import { getCardFromId, isCardInHand } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import { ORPCError } from "@orpc/server";
import { env } from "cloudflare:workers";

const logger = createLogger( "Callbreak:Service" );

export class CallbreakService {

	private readonly logger = createLogger( "Callbreak:Service" );

	public async getGameData( input: GameIdInput, authInfo: AuthInfo ) {
		logger.debug( ">> getGameData()" );

		const stub = await this.initializeStub( input.gameId, authInfo.id, async data => {
			if ( !data.players[ authInfo.id ] ) {
				logger.error( "Player Not in Game: %s", authInfo.id );
				throw new ORPCError( "FORBIDDEN", { message: "Player not in game!" } );
			}
		} );

		const { data } = await stub.getPlayerData( authInfo.id );
		return data;
	}

	public async createGame( input: CreateGameInput, authInfo: AuthInfo ) {
		logger.debug( ">> createGame()" );

		const durableObjectId = env.CALLBREAK_DO.newUniqueId();
		const stub = env.CALLBREAK_DO.get( durableObjectId );
		await stub.initialize( { ...input, authInfo } );
		const { data } = await stub.getPlayerData( authInfo.id );
		await this.saveDurableObjectId( { code: data.code, gameId: data.id, durableObjectId } );

		logger.debug( "<< createGame()" );
		return { gameId: data.id };
	}

	public async joinGame( input: JoinGameInput, authInfo: AuthInfo ) {
		logger.debug( ">> joinGame()" );

		const gameId = await this.getGameIdByCode( input.code );
		if ( !gameId ) {
			logger.debug( "Game not found for code %s!", input.code );
			throw new ORPCError( "BAD_REQUEST", { message: "Game not found!" } );
		}

		const stub = await this.initializeStub( gameId, authInfo.id, async data => {
			this.validateJoinGame( authInfo, data );
		} );

		await stub.addPlayer( authInfo );

		logger.debug( "<< joinGame()" );
		return { gameId };
	}

	public async declareDealWins( input: DeclareDealWinsInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> declareDealWins()" );

		const stub = await this.initializeStub( input.gameId, authInfo.id, async data => {
			this.validateDealWinDeclaration( input, authInfo, data );
		} );

		await stub.declareDealWins( input );

		this.logger.debug( "<< declareDealWins()" );
	}

	public async playCard( input: PlayCardInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> playCard()" );

		const stub = await this.initializeStub( input.gameId, authInfo.id, async data => {
			this.validatePlayCard( input, authInfo, data );
		} );

		await stub.playCard( input );

		this.logger.debug( "<< playCard()" );
	}

	/**
	 * Validates the join game request.
	 * Checks if the game exists, if the player is already in the game,
	 * and if the game is full.
	 * If any validation fails, it returns an error.
	 *
	 * @private
	 * @param {AuthInfo} authInfo - The authentication information of the player.
	 * @param {PlayerGameInfo} data - The current game data.
	 */
	private validateJoinGame( authInfo: AuthInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateJoinGame()" );

		if ( data.players[ authInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", authInfo.id );
			return;
		}

		if ( Object.keys( data.players ).length >= 4 ) {
			this.logger.error( "Game Full: %s", data.id );
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
	 * @param {PlayerGameInfo} data - The current game data.
	 */
	private validateDealWinDeclaration( input: DeclareDealWinsInput, authInfo: AuthInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateDealWinDeclaration()" );

		if ( !data.players[ authInfo.id ] ) {
			this.logger.error( "Player Not in Game: %s", authInfo.id );
			throw "Player not in game!";
		}

		if ( data.currentTurn !== authInfo.id ) {
			this.logger.error( "Not Your Turn: %s", authInfo.id );
			throw "Not your turn!";
		}

		if ( !data.currentDeal || data.currentDeal.id !== input.dealId ) {
			this.logger.error( "Active Deal Not Found: %s", data.id );
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
	 * @param {PlayerGameInfo} data - The current game data.
	 */
	private validatePlayCard( input: PlayCardInput, authInfo: AuthInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validatePlayCard()" );

		const { currentRound, currentDeal, players, currentTurn, hand, trump } = data;

		if ( !players[ authInfo.id ] ) {
			this.logger.error( "Player Not in Game: %s", authInfo.id );
			throw "Player not in game!";
		}

		if ( currentTurn !== authInfo.id ) {
			this.logger.error( "Not Your Turn: %s", authInfo.id );
			throw "Not your turn!";
		}

		if ( !currentDeal || currentDeal.id !== input.dealId ) {
			this.logger.error( "Deal Not Found: %s", input.dealId );
			throw "Deal not found!";
		}

		if ( !currentRound || currentRound.id !== input.roundId ) {
			this.logger.error( "Round Not Found: %s", input.roundId );
			throw "Round not found!";
		}

		if ( !isCardInHand( hand, input.cardId ) ) {
			this.logger.error( "Card Not Yours: %s", input.cardId );
			throw "Card not in hand!";
		}

		const cardsPlayed = Object.values( currentRound.cards ).map( getCardFromId );
		const isCardPlayAllowed = canCardBePlayed( input.cardId, hand, trump, cardsPlayed, currentRound.suit );

		if ( !isCardPlayAllowed ) {
			this.logger.error( "Invalid Card: %s", input.cardId );
			throw "Card cannot be played!";
		}

		this.logger.debug( "<< validatePlayCard()" );
	}

	private async initializeStub(
		gameId: string,
		playerId: string,
		runChecks: ( data: PlayerGameInfo ) => Promise<void>
	) {
		const durableObjectId = await this.getDurableObjectIdByGameId( gameId );
		if ( !durableObjectId ) {
			logger.debug( "Game not found for gameId %s!", gameId );
			throw new ORPCError( "BAD_REQUEST", { message: "Game not found!" } );
		}

		const stub = env.CALLBREAK_DO.get( durableObjectId );
		const { data } = await stub.getPlayerData( playerId );

		runChecks( data ).catch( error => {
			logger.error( "Error during checks:", error );
			throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
		} );

		return stub;
	}

	private async getGameIdByCode( code: string ) {
		return env.CALLBREAK_KV.get( `code:${ code }` );
	}

	private async getDurableObjectIdByGameId( gameId: string ) {
		const id = await env.CALLBREAK_KV.get( `gameId:${ gameId }` );
		return !id ? undefined : env.CALLBREAK_DO.idFromString( id );
	}

	private async saveDurableObjectId( data: { code: string, durableObjectId: DurableObjectId, gameId: string } ) {
		await env.CALLBREAK_KV.put( `code:${ data.code }`, data.durableObjectId.toString() );
		await env.CALLBREAK_KV.put( `gameId:${ data.gameId }`, data.durableObjectId.toString() );
	}
}

export const service = new CallbreakService();