"use server";

import type { GameIdInput } from "@/callbreak/server/inputs";
import {
	createGameInputSchema,
	declareDealWinsInputSchema,
	gameIdInputSchema,
	joinGameInputSchema,
	playCardInputSchema
} from "@/callbreak/server/inputs";
import * as service from "@/callbreak/server/service";
import { createLogger } from "@/shared/utils/logger";
import { ORPCError, os } from "@orpc/server";
import { requestInfo } from "rwsdk/worker";

const logger = createLogger( "Callbreak Functions" );

const gameMiddleware = os.middleware( async ( { next }, input ) => {
	if ( !requestInfo.ctx.authInfo ) {
		logger.error( "No auth info found in request context!" );
		throw new ORPCError( "UNAUTHORIZED", { message: "User not authenticated!" } );
	}

	const { gameId } = input as GameIdInput;
	const { game, players } = await service.getBaseGameData( gameId );

	if ( !players[ requestInfo.ctx.authInfo.id ] ) {
		logger.error( "Logged In User not part of this game! UserId: %s", requestInfo.ctx.authInfo.id );
		throw new ORPCError( "BAD_REQUEST", { message: "User not part of this game!" } );
	}

	return next( { context: { game, players } } );
} );

export const createGame = os
	.input( createGameInputSchema )
	.handler( async ( { input } ) => service.createGame( input, requestInfo.ctx.authInfo! ) )
	.actionable();

export const joinGame = os
	.input( joinGameInputSchema )
	.handler( async ( { input } ) => service.joinGame( input, requestInfo.ctx.authInfo! ) )
	.actionable();

export const getGameData = os
	.use( gameMiddleware )
	.input( gameIdInputSchema )
	.handler( async ( { context } ) => service.getGameData( { ...context, authInfo: requestInfo.ctx.authInfo! } ) )
	.actionable();

export const addBots = os
	.use( gameMiddleware )
	.input( gameIdInputSchema )
	.handler( async ( { context } ) => service.addBots( context ) )
	.actionable();

export const declareDealWins = os
	.use( gameMiddleware )
	.input( declareDealWinsInputSchema )
	.handler( async ( { input, context } ) => service.declareDealWins( input, context ) )
	.actionable();

export const playCard = os
	.use( gameMiddleware )
	.input( playCardInputSchema )
	.handler( async ( { input, context } ) => service.playCard( input, context ) )
	.actionable();