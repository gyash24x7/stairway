import { db } from "@/shared/db/client";
import { matches, matchPlayers } from "@/shared/db/schema";
import type {
	BaseGameConfig,
	BasePlayerInfo,
	EndResult,
	GameConfig,
	GameState,
	Match,
	MatchData,
	MatchId,
	MoveType,
	PlayerId
} from "@/shared/engine/types";
import { generateBotInfo } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

export class GameEngine<G, M extends Record<string, unknown>, C extends BaseGameConfig, V = G> {

	private readonly logger = createLogger( "Game:Engine" );

	public constructor( private readonly config: GameConfig<G, M, C, V> ) {}

	public async createMatch( config: C ) {
		this.logger.debug( ">> createMatch()" );

		const state: GameState<G> = {
			data: this.config.setup( config ),
			ctx: {
				turn: 0,
				players: [],
				currentPlayer: ""
			}
		};

		const data = {
			game: this.config.name,
			config: JSON.stringify( config ),
			state: JSON.stringify( state )
		};

		const [ match ] = await db.insert( matches ).values( data ).returning();

		this.logger.debug( "<< createMatch()" );
		return { id: match.id, code: match.code };
	}

	public async getMatch( matchId: MatchId ) {
		return this.findMatchById( matchId );
	}

	public getPlayerView( match: Match<G, C>, playerId: string ) {
		return this.config.playerView( match.state.data, match.config, playerId );
	}

	public async joinMatch( code: string, player: BasePlayerInfo ) {
		this.logger.debug( ">> joinMatch()" );

		const match = await this.findMatchByCode( code );
		if ( !match ) {
			this.logger.error( "Match not found!", code );
			throw new Error( "Match not found!" );
		}

		if ( !!match.players[ player.id ] ) {
			this.logger.warn( "Player already joined!" );
			return match;
		}

		if ( Object.keys( match.players ).length >= match.config.playerCount ) {
			this.logger.error( "Match is full:", match.id );
			throw new Error( "Match is full." );
		}

		if ( match.state.ctx.players.length === 0 ) {
			match.state.ctx.currentPlayer = player.id;
		}

		match.players[ player.id ] = player;
		match.state.ctx.players.push( player.id );

		if ( this.config.onJoin ) {
			match.state.data = this.config.onJoin( this.readonlyState( match.state ), match.config, player.id );
		}

		await db.insert( matchPlayers )
			.values( {
				playerId: player.id,
				matchId: match.id,
				name: player.name,
				avatar: player.avatar,
				isBot: player.isBot ? 1 : 0
			} );

		await this.updateMatch( match );
		await this.syncMatch( match );

		if ( Object.keys( match.players ).length === match.config.playerCount ) {
			await this.delay( 5000 );
			await this.startMatch( match.id );
		}

		this.logger.debug( "<< joinMatch()" );
		return match;
	}

	public async startMatch( matchId: MatchId ) {
		this.logger.debug( ">> startMatch()" );

		const match = await this.findMatchById( matchId );
		if ( !match ) {
			this.logger.error( "Match not found:", matchId );
			throw new Error( "Match not found." );
		}

		if ( Object.keys( match.players ).length < match.config.playerCount ) {
			this.logger.error( "Not enough players to start the match:", matchId );
			throw new Error( "Not enough players to start the match." );
		}

		if ( this.config.onStart ) {
			match.state.data = this.config.onStart( this.readonlyState( match.state ), match.config );
		}

		match.state.ctx.currentPlayer = this.resolveNextPlayer( match.state );
		match.status = "IN_PROGRESS";

		await this.updateMatch( match );
		await this.syncMatch( match );
		await this.processBotMoves( match );

		this.logger.debug( "<< startMatch()" );
	}

	public async processMove<T extends MoveType<M>>( matchId: MatchId, playerId: string, moveType: T, input: M[ T ] ) {
		this.logger.debug( ">> processMove()" );

		const match = await this.findMatchById( matchId );
		if ( !match ) {
			this.logger.error( "Match not found:", matchId );
			throw new Error( "Match not found." );
		}

		if ( match.status !== "IN_PROGRESS" ) {
			this.logger.error( "Match is not in progress:", matchId );
			throw new Error( "Match is not in progress." );
		}

		if ( !match.players[ playerId ] ) {
			this.logger.error( "Player not in match:", playerId, matchId );
			throw new Error( "Player not in match." );
		}

		const { currentPlayer } = match.state!.ctx;
		if ( currentPlayer !== playerId ) {
			this.logger.error( "Not player's turn:", playerId, matchId );
			throw new Error( "Not your turn." );
		}

		const move = this.config.moves[ moveType ];
		if ( !move ) {
			this.logger.error( "Invalid move type:", moveType, matchId );
			throw new Error( "Invalid move type." );
		}

		const readonlyState = this.readonlyState( match.state );
		move.validate( readonlyState, match.config, playerId, input );
		match.state.data = move.execute( readonlyState, match.config, playerId, input );
		match.state.ctx.currentPlayer = this.resolveNextPlayer( match.state );

		const endResult = this.config.endIf( this.readonlyState( match.state ), match.config );
		if ( endResult ) {
			match.status = "COMPLETED";
			match.result = endResult;
			this.logger.info( "Match completed!" );

			if ( endResult.victory && "winner" in endResult ) {
				this.logger.info( "Winner:", endResult.winner );
			} else {
				this.logger.info( "Game ended in a draw." );
			}
		}

		await this.updateMatch( match );
		await this.syncMatch( match );
		await this.runAfterMove( match );
		await this.processBotMoves( match );

		this.logger.debug( "<< processMove()" );
	}

	public async addBots( matchId: MatchId ) {
		this.logger.debug( ">> addBots()" );

		if ( !this.config.botMove ) {
			throw new Error( "This game does not support bots." );
		}

		const match = await this.findMatchById( matchId );
		if ( !match ) {
			throw new Error( "Match not found." );
		}

		const remaining = match.config.playerCount - Object.keys( match.players ).length;
		const bots = Array.from( { length: remaining }, () => generateBotInfo() );

		await this.updateMatch( match );

		for ( const bot of bots ) {
			await this.joinMatch( match.code, bot );
		}

		this.logger.debug( "<< addBots()" );
	}

	private async runAfterMove( match: Match<G, C> ): Promise<boolean> {
		if ( !this.config.afterMove ) {
			return false;
		}

		const result = this.config.afterMove( this.readonlyState( match.state ), match.config );
		if ( result === undefined ) {
			return false;
		}

		await this.delay( 5000 );
		match.state.data = result;

		const endResult = this.config.endIf( this.readonlyState( match.state ), match.config );
		if ( endResult ) {
			match.status = "COMPLETED";
			match.result = endResult;
		}

		await this.updateMatch( match );
		await this.syncMatch( match );
		return true;
	}

	private async processBotMoves( match: Match<G, C> ) {
		if ( !this.config.botMove ) {
			return;
		}

		let skipDelay = false;

		while ( match.status === "IN_PROGRESS" && match.players[ match.state.ctx.currentPlayer ].isBot ) {
			if ( !skipDelay ) {
				await this.delay( 5000 );
			}
			skipDelay = false;

			const playerId = match.state.ctx.currentPlayer;
			const { moveType, input } = this.config.botMove(
				this.readonlyPlayerState( match.state, match.config, playerId ),
				match.config
			);

			const move = this.config.moves[ moveType ];
			const readonlyState = this.readonlyState( match.state );
			move.validate( readonlyState, match.config, playerId, input );

			match.state.data = move.execute( readonlyState, match.config, playerId, input );
			match.state.ctx.currentPlayer = this.resolveNextPlayer( match.state );

			const endResult = this.config.endIf( this.readonlyState( match.state ), match.config );
			if ( endResult ) {
				match.status = "COMPLETED";
				match.result = endResult;
			}

			await this.updateMatch( match );
			await this.syncMatch( match );

			if ( this.config.afterMove ) {
				skipDelay = await this.runAfterMove( match );
			}
		}
	}

	private async delay( ms: number ) {
		return new Promise( resolve => setTimeout( resolve, ms ) );
	}

	private readonlyState( state: GameState<G> ): GameState<G> {
		return { data: state.data, ctx: Object.freeze( { ...state.ctx } ) };
	}

	private readonlyPlayerState( state: GameState<G>, config: C, playerId: PlayerId ): GameState<V> {
		return {
			data: this.config.playerView( state.data, config, playerId ),
			ctx: Object.freeze( { ...state.ctx } )
		};
	}

	private async syncMatch( match: Match<G, C> ) {
		const id = env.SYNC_SERVER.idFromName( `${ this.config.name }:${ match.id }` );
		const syncServer = env.SYNC_SERVER.get( id );

		for ( const playerId of Object.keys( match.players ).filter( id => !match.players[ id ].isBot ) ) {
			const data = this.getPlayerView( match, playerId );
			await syncServer.publish( playerId, { ...match, state: { ...match.state, data } } );
		}
	}

	private resolveNextPlayer( state: GameState<G> ): PlayerId {
		state.ctx.turn++;

		const { getNextPlayer } = this.config;

		if ( getNextPlayer === "round-robin" ) {
			const index = state.ctx.turn % state.ctx.players.length;
			return state.ctx.players[ index ];
		}

		return getNextPlayer( state );
	}

	private deserializeMatch( matchData: MatchData ) {
		const players: Record<string, BasePlayerInfo> = {};
		for ( const p of matchData.players ) {
			players[ p.playerId ] = { id: p.playerId, name: p.name, avatar: p.avatar, isBot: !!p.isBot };
		}

		const match: Match<G, C> = {
			id: matchData.id,
			code: matchData.code,
			config: JSON.parse( matchData.config ) as C,
			state: JSON.parse( matchData.state ) as GameState<G>,
			status: matchData.status,
			players,
			result: matchData.result ? JSON.parse( matchData.result ) as EndResult : undefined
		};

		return match;
	}

	private async findMatchById( matchId: MatchId ) {
		return db.query.matches.findFirst( { where: { id: matchId }, with: { players: true } } )
			.then( d => !!d ? this.deserializeMatch( d ) : undefined );
	}

	private async findMatchByCode( code: string ) {
		return db.query.matches.findFirst( { where: { code }, with: { players: true } } )
			.then( d => !!d ? this.deserializeMatch( d ) : undefined );
	}

	private async updateMatch( match: Match<G, C> ) {
		await db.update( matches )
			.set( {
				state: JSON.stringify( match.state ),
				status: match.status,
				result: match.result ? JSON.stringify( match.result ) : null
			} )
			.where( eq( matches.id, match.id ) );
	}
}
