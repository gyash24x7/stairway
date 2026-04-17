import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import type { GameId } from "@/shared/engine/types";
import { createLogger } from "@/shared/utils/logger";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { and, eq } from "drizzle-orm";
import { requestInfo } from "rwsdk/worker";

const logger = createLogger( "Middlewares" );

export const validate = ( schema: StandardSchemaV1 ) => {
	return async ( { args }: any ) => {
		const result = await schema[ "~standard" ].validate( args[ 0 ] );
		if ( result.issues ) {
			throw new Response( null, { status: 400 } );
		}
	};
};

export const requireauthInfo = () => {
	const authInfo = requestInfo.ctx.authInfo;
	if ( !authInfo ) {
		logger.error( "User not logged in!" );
		throw new Response( null, { status: 403 } );
	}
};

export function getAuthInfo() {
	const authInfo = requestInfo.ctx.authInfo;
	if ( !authInfo ) {
		logger.error( "User not logged in!" );
		throw new Response( null, { status: 403 } );
	}
	return authInfo;
}

export const requireGame = async ( name: string, gameId: GameId ) => {
	const game = await db.query.games.findFirst( {
		where: and( eq( games.id, gameId ), eq( games.game, name ) )
	} );

	if ( !game ) {
		logger.error( "Game not found!" );
		throw new Response( null, { status: 404 } );
	}

	return game;
};