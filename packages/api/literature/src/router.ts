import { createContextFn, createLogger, trpc } from "@stairway/api/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "./constants.ts";
import {
	askCardInputSchema,
	callSetInputSchema,
	createGameInputSchema,
	createTeamsInputSchema,
	gameIdInputSchema,
	joinGameInputSchema,
	transferTurnInputSchema
} from "./inputs.ts";
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
} from "./service.ts";
import type { GameStatus } from "./types.ts";

const logger = createLogger( "LiteratureRouter" );

type MiddlewareData = { status?: GameStatus, turn?: true, isGameDataQuery?: true };

const middleware = ( data?: MiddlewareData ) => trpc.middleware( async opts => {
	const { authInfo } = opts.ctx;
	const { gameId } = await opts.getRawInput() as { gameId: string };
	const { game, players, teams } = await getGameData( gameId );

	if ( !players[ authInfo.id ] ) {
		logger.error( "Logged In User not part of this game! UserId: %s", authInfo.id );
		throw new TRPCError( { code: "FORBIDDEN", message: Messages.PLAYER_NOT_PART_OF_GAME } );
	}

	if ( !!data?.status && game.status !== data.status ) {
		logger.error( "Game Status is not %s! GameId: %s", data.status, game.id );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INCORRECT_STATUS } );
	}

	if ( !!data?.turn && game.currentTurn !== authInfo.id ) {
		logger.error( "It's not your turn! GameId: %s", game.id );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_OUT_OF_TURN } );
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

const router = trpc.router( {
	createGame: trpc.procedure.input( createGameInputSchema )
		.mutation( ( { input, ctx } ) => createGame( input, ctx ) ),

	joinGame: trpc.procedure.input( joinGameInputSchema )
		.mutation( ( { input, ctx } ) => joinGame( input, ctx ) ),

	getGameData: trpc.procedure.input( gameIdInputSchema )
		.use( middleware( { isGameDataQuery: true } ) )
		.query( ( { ctx: { authInfo, ...rest } } ) => ( { ...rest, playerId: authInfo.id } ) ),

	addBots: trpc.procedure.input( gameIdInputSchema )
		.use( middleware( { status: "CREATED" } ) )
		.mutation( ( { ctx } ) => addBots( ctx ) ),

	createTeams: trpc.procedure.input( createTeamsInputSchema )
		.use( middleware( { status: "PLAYERS_READY" } ) )
		.mutation( ( { input, ctx } ) => createTeams( input, ctx ) ),

	startGame: trpc.procedure.input( gameIdInputSchema )
		.use( middleware( { status: "TEAMS_CREATED" } ) )
		.mutation( ( { ctx } ) => startGame( ctx ) ),

	askCard: trpc.procedure.input( askCardInputSchema )
		.use( middleware( { status: "IN_PROGRESS", turn: true } ) )
		.mutation( ( { input, ctx } ) => askCard( input, ctx ) ),

	callSet: trpc.procedure.input( callSetInputSchema )
		.use( middleware( { status: "IN_PROGRESS", turn: true } ) )
		.mutation( ( { input, ctx } ) => callSet( input, ctx ) ),

	transferTurn: trpc.procedure.input( transferTurnInputSchema )
		.use( middleware( { status: "IN_PROGRESS", turn: true } ) )
		.mutation( ( { input, ctx } ) => transferTurn( input, ctx ) ),

	executeBotMove: trpc.procedure.input( gameIdInputSchema )
		.use( middleware( { status: "IN_PROGRESS" } ) )
		.mutation( ( { ctx } ) => executeBotMove( ctx ) )
} );

const createCaller = trpc.createCallerFactory( router );
export const caller = createCaller( createContextFn );