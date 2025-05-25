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
import { authMiddleware } from "@/shared/utils/orpc";
import { ORPCError, os } from "@orpc/server";

const logger = createLogger( "Callbreak Functions" );

const gameMiddleware = authMiddleware.concat( async ( { context, next }, input ) => {
	const { gameId } = input as GameIdInput;
	const { game, players } = await service.getBaseGameData( gameId );

	if ( !players[ context.authInfo.id ] ) {
		logger.error( "Logged In User not part of this game! UserId: %s", context.authInfo.id );
		throw new ORPCError( "BAD_REQUEST", { message: "User not part of this game!" } );
	}

	return next( { context: { game, players } } );
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
	.use( gameMiddleware )
	.input( gameIdInputSchema )
	.handler( async ( { context } ) => service.getGameData( context ) )
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