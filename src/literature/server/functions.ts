"use server";

import {
	askCardInputSchema,
	callSetInputSchema,
	createGameInputSchema,
	createTeamsInputSchema,
	type GameIdInput,
	gameIdInputSchema,
	joinGameInputSchema,
	transferTurnInputSchema
} from "@/literature/server/inputs";
import * as service from "@/literature/server/service";
import type { Literature } from "@/literature/types";
import { createLogger } from "@/shared/utils/logger";
import { authMiddleware } from "@/shared/utils/orpc";
import { ORPCError, os } from "@orpc/server";

const logger = createLogger( "Literature Functions" );

type MiddlewareData = { status?: Literature.GameStatus, turn?: true, isGameDataQuery?: true };

const gameMiddleware = ( data?: MiddlewareData ) => authMiddleware.concat( async ( { context, next }, input ) => {
	const { gameId } = input as GameIdInput;
	const { game, players, teams } = await service.getGameData( gameId );

	if ( !players[ context.authInfo.id ] ) {
		logger.error( "Logged In User not part of this game! UserId: %s", context.authInfo.id );
		throw new ORPCError( "BAD_REQUEST", { message: "User not part of this game!" } );
	}

	if ( !!data?.status && game.status !== data.status ) {
		logger.error( "Game Status is not %s! GameId: %s", data.status, game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "Game is in incorrect status!" } );
	}

	if ( !!data?.turn && game.currentTurn !== context.authInfo.id ) {
		logger.error( "It's not your turn! GameId: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "It is not your turn!" } );
	}

	const cardCounts = game.status === "IN_PROGRESS"
		? await service.getCardCounts( game.id, players )
		: {};

	const hand = data?.isGameDataQuery
		? await service.getPlayerHand( game.id, context.authInfo.id )
		: [];

	const lastMoveData = data?.isGameDataQuery
		? await service.getLastMoveData( game.lastMoveId )
		: undefined;

	const asks = data?.isGameDataQuery
		? await service.getPreviousAsks( game.id )
		: [];

	const metrics = data?.isGameDataQuery
		? await service.getMetrics( game, players, teams )
		: { player: [], team: [] };

	return next( { context: { game, players, teams, cardCounts, hand, lastMoveData, asks, metrics } } );
} );

export const createGame = os
	.use( authMiddleware )
	.input( createGameInputSchema )
	.handler( async ( { input, context } ) => service.createGame( input, context ) )
	.actionable();

export const joinGame = os
	.use( authMiddleware )
	.input( joinGameInputSchema )
	.handler( async ( { input, context } ) => service.joinGame( input, context ) )
	.actionable();

export const getGameData = os
	.use( gameMiddleware( { isGameDataQuery: true } ) )
	.input( gameIdInputSchema )
	.handler( async ( { context: { authInfo, ...rest } } ) => ( { ...rest, playerId: authInfo.id } ) )
	.actionable();

export const addBots = os
	.use( gameMiddleware( { status: "CREATED" } ) )
	.input( gameIdInputSchema )
	.handler( async ( { context } ) => service.addBots( context ) )
	.actionable();

export const createTeams = os
	.use( gameMiddleware( { status: "PLAYERS_READY" } ) )
	.input( createTeamsInputSchema )
	.handler( async ( { input, context } ) => service.createTeams( input, context ) )
	.actionable();

export const startGame = os
	.use( gameMiddleware( { status: "TEAMS_CREATED" } ) )
	.input( gameIdInputSchema )
	.handler( async ( { context } ) => service.startGame( context ) )
	.actionable();

export const askCard = os
	.use( gameMiddleware( { status: "IN_PROGRESS" } ) )
	.input( askCardInputSchema )
	.handler( async ( { input, context } ) => service.askCard( input, context ) )
	.actionable();

export const callSet = os
	.use( gameMiddleware( { status: "IN_PROGRESS" } ) )
	.input( callSetInputSchema )
	.handler( async ( { input, context } ) => service.callSet( input, context ) )
	.actionable();

export const transferTurn = os
	.use( gameMiddleware( { status: "IN_PROGRESS" } ) )
	.input( transferTurnInputSchema )
	.handler( async ( { input, context } ) => service.transferTurn( input, context ) )
	.actionable();

export const executeBotMove = os
	.use( gameMiddleware( { status: "IN_PROGRESS" } ) )
	.input( gameIdInputSchema )
	.handler( async ( { context } ) => service.executeBotMove( context ) )
	.actionable();