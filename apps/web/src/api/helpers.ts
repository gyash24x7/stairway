import { db } from "@s2h/db";
import { games } from "@s2h/db/schema";
import type {
	BaseGameConfig,
	BasePlayerView,
	CompletedGameData,
	GameId
} from "@s2h/engine/types";
import { createLogger } from "@s2h/shared/utils/logger";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

const logger = createLogger( "Api:Helpers" );

/**
 * Fetches a game by its name and ID from the database.
 * Throws `NOT_FOUND` if the game is not found.
 * @param name - The game type name (e.g. "kingdomino", "callbreak").
 * @param gameId - The unique game instance ID.
 */
export const requireGame = async ( name: string, gameId: GameId ) => {
	const game = await db.query.games.findFirst( {
		where: and( eq( games.id, gameId ), eq( games.game, name ) )
	} );

	if ( !game ) {
		logger.error( "Game not found! %s:%s", name, gameId );
		throw new ORPCError( "NOT_FOUND" );
	}

	return game;
};

/**
 * Fetches a game by its name and join code from the database.
 * Throws `NOT_FOUND` if the game is not found.
 * @param name - The game type name.
 * @param code - The short join code for the game.
 */
export const requireGameByCode = async ( name: string, code: string ) => {
	const game = await db.query.games.findFirst( {
		where: and( eq( games.code, code ), eq( games.game, name ) )
	} );

	if ( !game ) {
		logger.error( "Game not found! %s:%s", name, code );
		throw new ORPCError( "NOT_FOUND" );
	}

	return game;
};

/**
 * Fetches archived completed game data from KV.
 * Throws `NOT_FOUND` if the data is not found.
 * @param env - The Worker environment (for GAMES_KV).
 * @param name - The game type name.
 * @param gameId - The unique game instance ID.
 */
export const getCompletedGame = async <SV, C extends BaseGameConfig, PV extends BasePlayerView>(
	env: Env,
	name: string,
	gameId: GameId
) => {
	const key = `${ name }:${ gameId }`;
	const data = await env.GAMES_KV.get<CompletedGameData<SV, C, PV>>( key, { type: "json" } );

	if ( !data ) {
		logger.error( "Completed game data not found in KV! %s", key );
		throw new ORPCError( "NOT_FOUND" );
	}

	return data;
};
