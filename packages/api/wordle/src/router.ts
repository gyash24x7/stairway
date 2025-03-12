import type { Auth } from "@stairway/types/auth";
import { createLogger } from "@stairway/utils";
import { initTRPC, TRPCError } from "@trpc/server";
import type { GameIdInput } from "./inputs";
import { createGameInputSchema, gameIdInputSchema, makeGuessInputSchema } from "./inputs";
import { createGame, getGameData, makeGuess } from "./service";

const logger = createLogger( "WordleRouter" );
const trpc = initTRPC.context<Auth.Context>().create();

const middleware = ( requireInProgress?: boolean ) => trpc.middleware( async opts => {
	const { gameId } = await opts.getRawInput() as GameIdInput;
	const { authInfo } = opts.ctx;
	const game = await getGameData( gameId );

	if ( !game ) {
		logger.error( "Game Not Found! UserId: %s", authInfo.id );
		throw new TRPCError( { code: "NOT_FOUND", message: "Game Not Found!" } );
	}

	if ( game.playerId !== authInfo.id ) {
		logger.error( "Logged In User is not playing this game! UserId: %s", authInfo.id );
		throw new TRPCError( { code: "FORBIDDEN", message: "The Player is not part of the Game!" } );
	}

	if ( requireInProgress && game.completedWords.length === game.words.length ) {
		logger.error( "Game Status is incorrect! GameId: %s", game.id );
		throw new TRPCError( { code: "BAD_REQUEST", message: "Game is in incorrect status!" } );
	}

	return opts.next( { ctx: { authInfo, game } } );
} );

export const router = trpc.router( {
	createGame: trpc.procedure.input( createGameInputSchema )
		.mutation( ( { input, ctx } ) => createGame( input, ctx ) ),

	makeGuess: trpc.procedure.input( makeGuessInputSchema ).use( middleware( true ) )
		.mutation( ( { input, ctx } ) => makeGuess( input, ctx.game ) ),

	getGame: trpc.procedure.input( gameIdInputSchema ).use( middleware() ).query( ( { ctx: { game } } ) => game )
} );