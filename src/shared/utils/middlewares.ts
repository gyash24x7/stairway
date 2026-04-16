import { useAppSession } from "@/auth/core/sessions";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import { createLogger } from "@/shared/utils/logger";
import { createMiddleware } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

const logger = createLogger( "Middlewares" );

export const requireAuthInfo = createMiddleware().server(
	async ( { next } ) => {
		const session = await useAppSession();
		if ( !session.data || !session.data.authInfo ) {
			logger.warn( "Not logged in!" );
			throw new Response( null, { status: 401 } );
		}

		return next( { context: { authInfo: session.data.authInfo } } );
	}
);

export const requireGame = ( name: string ) => createMiddleware( { type: "function" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.server(
		async ( { next, data } ) => {
			const game = await db.query.games.findFirst( {
				where: and( eq( games.id, data.gameId ), eq( games.game, name ) )
			} );

			if ( !game ) {
				logger.error( "Game not found!" );
				throw new Response( null, { status: 404 } );
			}

			return next( { context: { game } } );
		}
	);