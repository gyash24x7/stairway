import { Injectable } from "@nestjs/common";
import { LoggerFactory, TrpcService } from "@shared/api";
import { CardHand } from "@stairway/cards";
import { TRPCError } from "@trpc/server";
import { Messages } from "./literature.constants.ts";
import {
	askCardInputSchema,
	callSetInputSchema,
	createGameInputSchema,
	createTeamsInputSchema,
	gameIdInputSchema,
	joinGameInputSchema,
	transferTurnInputSchema
} from "./literature.inputs.ts";
import { LiteratureMutations } from "./literature.mutations.ts";
import { LiteratureQueries } from "./literature.queries.ts";
import type { GameStatus } from "./literature.types.ts";


@Injectable()
export class LiteratureRouter {

	private readonly logger = LoggerFactory.getLogger( LiteratureRouter );

	constructor(
		private readonly trpc: TrpcService,
		private readonly queries: LiteratureQueries,
		private readonly mutations: LiteratureMutations
	) {}

	router() {
		return this.trpc.router( {
			createGame: this.trpc.procedure.input( createGameInputSchema )
				.mutation( ( { input, ctx } ) => this.mutations.createGame( input, ctx ) ),

			joinGame: this.trpc.procedure.input( joinGameInputSchema )
				.mutation( ( { input, ctx } ) => this.mutations.joinGame( input, ctx ) ),

			getGameData: this.trpc.procedure.input( gameIdInputSchema )
				.use( this.gameDataMiddleware( { isGameDataQuery: true } ) )
				.query( ( { ctx: { authInfo, ...rest } } ) => ( { ...rest, playerId: authInfo.id } ) ),

			getPreviousAsks: this.trpc.procedure.input( gameIdInputSchema )
				.use( this.gameDataMiddleware() )
				.query( ( { ctx } ) => this.queries.getPreviousAsks( ctx.game.id ) ),

			addBots: this.trpc.procedure.input( gameIdInputSchema )
				.use( this.gameDataMiddleware( { status: "CREATED" } ) )
				.mutation( ( { ctx } ) => this.mutations.addBots( ctx ) ),

			createTeams: this.trpc.procedure.input( createTeamsInputSchema )
				.use( this.gameDataMiddleware( { status: "PLAYERS_READY" } ) )
				.mutation( ( { input, ctx } ) => this.mutations.createTeams( input, ctx ) ),

			startGame: this.trpc.procedure.input( gameIdInputSchema )
				.use( this.gameDataMiddleware( { status: "TEAMS_CREATED" } ) )
				.mutation( ( { ctx } ) => this.mutations.startGame( ctx ) ),

			askCard: this.trpc.procedure.input( askCardInputSchema )
				.use( this.gameDataMiddleware( { status: "IN_PROGRESS", turn: true } ) )
				.mutation( ( { input, ctx } ) => this.mutations.askCard( input, ctx ) ),

			callSet: this.trpc.procedure.input( callSetInputSchema )
				.use( this.gameDataMiddleware( { status: "IN_PROGRESS", turn: true } ) )
				.mutation( ( { input, ctx } ) => this.mutations.callSet( input, ctx ) ),

			transferTurn: this.trpc.procedure.input( transferTurnInputSchema )
				.use( this.gameDataMiddleware( { status: "IN_PROGRESS", turn: true } ) )
				.mutation( ( { input, ctx } ) => this.mutations.transferTurn( input, ctx ) ),

			executeBotMove: this.trpc.procedure.input( gameIdInputSchema )
				.use( this.gameDataMiddleware( { status: "IN_PROGRESS" } ) )
				.mutation( ( { ctx } ) => this.mutations.executeBotMove( ctx ) )
		} );
	}

	gameDataMiddleware( data?: { status?: GameStatus, turn?: true, isGameDataQuery?: true } ) {
		return this.trpc.middleware( async opts => {
			const { authInfo } = opts.ctx;
			const { gameId } = await opts.getRawInput() as { gameId: string };
			const { game, players, teams } = await this.queries.getGameData( gameId );

			if ( !players[ authInfo.id ] ) {
				this.logger.error( "Logged In User not part of this game! UserId: %s", authInfo.id );
				throw new TRPCError( { code: "FORBIDDEN", message: Messages.PLAYER_NOT_PART_OF_GAME } );
			}

			if ( !!data?.status && game.status !== data.status ) {
				this.logger.error( "Game Status is not %s! GameId: %s", data.status, game.id );
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INCORRECT_STATUS } );
			}

			if ( !!data?.turn && game.currentTurn !== authInfo.id ) {
				this.logger.error( "It's not your turn! GameId: %s", game.id );
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_OUT_OF_TURN } );
			}

			const cardCounts = game.status === "IN_PROGRESS"
				? await this.queries.getCardCounts( game.id, players )
				: {};

			const hand = data?.isGameDataQuery
				? await this.queries.getPlayerHand( game.id, authInfo.id )
				: CardHand.empty();

			const lastMoveData = data?.isGameDataQuery
				? await this.queries.getLastMoveData( game.lastMoveId )
				: undefined;

			return opts.next( {
				ctx: {
					authInfo,
					game,
					players,
					teams,
					cardCounts,
					hand: hand.serialize(),
					lastMoveData
				}
			} );
		} );
	}
}