import type { Auth } from "@stairway/types/auth";
import type { Literature } from "@stairway/types/literature";
import { createLogger } from "@stairway/utils";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import {
	askCardInputSchema,
	callSetInputSchema,
	createGameInputSchema,
	createTeamsInputSchema,
	gameIdInputSchema,
	joinGameInputSchema,
	transferTurnInputSchema
} from "./inputs";
import {
	addBots,
	askCard,
	callSet,
	createGame,
	createTeams,
	executeBotMove,
	getCardCounts,
	getGameData,
	getLastMoveData,
	getMetrics,
	getPlayerHand,
	getPreviousAsks,
	joinGame,
	startGame,
	transferTurn
} from "./service";

const logger = createLogger( "LiteratureRouter" );
const trpc = initTRPC.context<Auth.Context>().create( {
	transformer: superjson
} );

type MiddlewareData = { status?: Literature.GameStatus, turn?: true, isGameDataQuery?: true };

const middleware = ( data?: MiddlewareData ) => trpc.middleware( async opts => {
	const { authInfo } = opts.ctx;
	const { gameId } = await opts.getRawInput() as { gameId: string };
	const { game, players, teams } = await getGameData( gameId );

	if ( !players[ authInfo.id ] ) {
		logger.error( "Logged In User not part of this game! UserId: %s", authInfo.id );
		throw new TRPCError( { code: "FORBIDDEN", message: "The Logged In Player is not part of the Game!" } );
	}

	if ( !!data?.status && game.status !== data.status ) {
		logger.error( "Game Status is not %s! GameId: %s", data.status, game.id );
		throw new TRPCError( { code: "BAD_REQUEST", message: "Game is in incorrect status!" } );
	}

	if ( !!data?.turn && game.currentTurn !== authInfo.id ) {
		logger.error( "It's not your turn! GameId: %s", game.id );
		throw new TRPCError( { code: "BAD_REQUEST", message: "It is not your turn!" } );
	}

	const cardCounts = game.status === "IN_PROGRESS"
		? await getCardCounts( game.id, players )
		: {};

	const hand = data?.isGameDataQuery
		? await getPlayerHand( game.id, authInfo.id )
		: [];

	const lastMoveData = data?.isGameDataQuery
		? await getLastMoveData( game.lastMoveId )
		: undefined;

	const asks = data?.isGameDataQuery
		? await getPreviousAsks( game.id )
		: [];

	const metrics = data?.isGameDataQuery
		? await getMetrics( game, players, teams )
		: { player: [], team: [] };

	return opts.next( { ctx: { authInfo, game, players, teams, cardCounts, hand, lastMoveData, asks, metrics } } );
} );

export const router = trpc.router( {
	createGame: trpc.procedure.input( createGameInputSchema )
		.mutation( ( { input, ctx } ) => createGame( input, ctx.authInfo ) ),

	joinGame: trpc.procedure.input( joinGameInputSchema )
		.mutation( ( { input, ctx } ) => joinGame( input, ctx.authInfo ) ),

	getGameData: trpc.procedure.input( gameIdInputSchema )
		.use( middleware( { isGameDataQuery: true } ) )
		.query( ( { ctx: { authInfo, ...rest } } ) => ( { ...rest, playerId: authInfo.id } ) ),

	addBots: trpc.procedure.input( gameIdInputSchema )
		.use( middleware( { status: "CREATED" } ) )
		.mutation( ( { ctx } ) => addBots( ctx.game, ctx.players ) ),

	createTeams: trpc.procedure.input( createTeamsInputSchema )
		.use( middleware( { status: "PLAYERS_READY" } ) )
		.mutation( ( { input, ctx } ) => createTeams( input, ctx.game, ctx.players ) ),

	startGame: trpc.procedure.input( gameIdInputSchema )
		.use( middleware( { status: "TEAMS_CREATED" } ) )
		.mutation( ( { ctx } ) => startGame( ctx.game, ctx.players ) ),

	askCard: trpc.procedure.input( askCardInputSchema )
		.use( middleware( { status: "IN_PROGRESS", turn: true } ) )
		.mutation( ( { input, ctx } ) => askCard( input, ctx.game, ctx.players, ctx.cardCounts ) ),

	callSet: trpc.procedure.input( callSetInputSchema )
		.use( middleware( { status: "IN_PROGRESS", turn: true } ) )
		.mutation( ( { input, ctx } ) => callSet( input, ctx.game, ctx.players, ctx.teams, ctx.cardCounts ) ),

	transferTurn: trpc.procedure.input( transferTurnInputSchema )
		.use( middleware( { status: "IN_PROGRESS", turn: true } ) )
		.mutation( ( { input, ctx } ) => transferTurn( input, ctx.game, ctx.players, ctx.cardCounts ) ),

	executeBotMove: trpc.procedure.input( gameIdInputSchema )
		.use( middleware( { status: "IN_PROGRESS" } ) )
		.mutation( ( { ctx } ) => executeBotMove( ctx.game, ctx.players, ctx.teams, ctx.cardCounts ) )
} );
