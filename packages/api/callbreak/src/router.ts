import type { Auth } from "@stairway/types/auth";
import { createLogger } from "@stairway/utils";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import {
	createGameInputSchema,
	declareDealWinsInputSchema,
	gameIdInputSchema,
	joinGameInputSchema,
	playCardInputSchema
} from "./inputs";
import { addBots, createGame, declareDealWins, getBaseGameData, getGameData, joinGame, playCard } from "./service";

const logger = createLogger( "CallbreakRouter" );
const trpc = initTRPC.context<Auth.Context>().create( {
	transformer: superjson
} );

function middleware() {
	return trpc.middleware( async opts => {

		const { gameId } = await opts.getRawInput() as { gameId: string };
		const authInfo = opts.ctx.authInfo;

		const { game, players } = await getBaseGameData( gameId );

		if ( !players[ authInfo.id ] ) {
			logger.error( "Logged In User not part of this game! UserId: %s", authInfo.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: "User not part of this game!" } );
		}

		return opts.next( { ctx: { game, players } } );
	} );
}

export const router = trpc.router( {
	createGame: trpc.procedure.input( createGameInputSchema )
		.mutation( ( { input, ctx } ) => createGame( input, ctx.authInfo ) ),

	joinGame: trpc.procedure.input( joinGameInputSchema )
		.mutation( ( { input, ctx } ) => joinGame( input, ctx.authInfo ) ),

	getGameData: trpc.procedure.input( gameIdInputSchema ).use( middleware() )
		.query( ( { ctx } ) => getGameData( ctx.game, ctx.players, ctx.authInfo ) ),

	addBots: trpc.procedure.input( gameIdInputSchema ).use( middleware() )
		.mutation( ( { ctx } ) => addBots( ctx.game, ctx.players ) ),

	declareDealWins: trpc.procedure.input( declareDealWinsInputSchema ).use( middleware() )
		.mutation( ( { input, ctx } ) => {
			return declareDealWins( input, ctx.game, ctx.players, ctx.authInfo.id );
		} ),

	playCard: trpc.procedure.input( playCardInputSchema ).use( middleware() )
		.mutation( ( { input, ctx } ) => {
			return playCard( input, ctx.game, ctx.players, ctx.authInfo.id );
		} )
} );