import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import type {
	BaseGameConfig,
	BasePlayerView,
	CompletedGameData,
	GameId
} from "@/shared/engine/types";
import { createLogger } from "@/shared/utils/logger";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { requestInfo } from "rwsdk/worker";

const logger = createLogger( "Middlewares" );

/**
 * Creates a middleware that validates server action input against a Valibot schema.
 * Throws a 400 response if validation fails.
 * @param schema - The StandardSchema-compatible validation schema.
 * @returns A middleware function that validates the first argument of the server action.
 */
export const validate = ( schema: StandardSchemaV1 ) => {
	return async ( { args }: any ) => {
		const result = await schema[ "~standard" ].validate( args[ 0 ] );
		if ( result.issues ) {
			logger.error( "Validation failed! %s", result.issues[ 0 ].message );
			throw new Response( null, { status: 400 } );
		}
	};
};

/**
 * Middleware that throws a 403 response if no authenticated user is found.
 */
export const requireauthInfo = () => {
	const authInfo = requestInfo.ctx.authInfo;
	if ( !authInfo ) {
		logger.error( "User not logged in!" );
		throw new Response( null, { status: 403 } );
	}
};

/**
 * Returns the authenticated user info from the current request context.
 * Throws a 403 response if no authenticated user is found.
 * @returns The authenticated user's auth info.
 */
export function getAuthInfo() {
	const authInfo = requestInfo.ctx.authInfo;
	if ( !authInfo ) {
		logger.error( "User not logged in!" );
		throw new Response( null, { status: 403 } );
	}
	return authInfo;
}

/**
 * Fetches a game by its name and ID from the database.
 * Throws a 404 response if the game is not found.
 * @param name - The game type name (e.g. "kingdomino", "callbreak").
 * @param gameId - The unique game instance ID.
 * @returns The game record from the database.
 */
export const requireGame = async ( name: string, gameId: GameId ) => {
	const game = await db.query.games.findFirst( {
		where: and( eq( games.id, gameId ), eq( games.game, name ) )
	} );

	if ( !game ) {
		logger.error( "Game not found! %s:%s", name, gameId );
		throw new Response( null, { status: 404 } );
	}

	return game;
};

/**
 * Fetches a game by its name and join code from the database.
 * Throws a 404 response if the game is not found.
 * @param name - The game type name (e.g. "kingdomino", "callbreak").
 * @param code - The short join code for the game.
 * @returns The game record from the database.
 */
export const requireGameByCode = async ( name: string, code: string ) => {
	const game = await db.query.games.findFirst( {
		where: and( eq( games.code, code ), eq( games.game, name ) )
	} );

	if ( !game ) {
		logger.error( "Game not found! %s:%s", name, code );
		throw new Response( null, { status: 404 } );
	}

	return game;
};

/**
 * Fetches archived completed game data from KV.
 * Throws a 404 response if the data is not found.
 * @param name - The game type name.
 * @param gameId - The unique game instance ID.
 * @returns The completed game data with pre-computed views.
 */
export const getCompletedGame = async <SV, C extends BaseGameConfig, PV extends BasePlayerView>(
	name: string,
	gameId: GameId
) => {
	const key = `${ name }:${ gameId }`;
	const data = await env.GAMES_KV.get<CompletedGameData<SV, C, PV>>( key, { type: "json" } );

	if ( !data ) {
		logger.error( "Completed game data not found in KV! %s", key );
		throw new Response( null, { status: 404 } );
	}

	return data;
};
