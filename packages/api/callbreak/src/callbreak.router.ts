import type { UserAuthInfo } from "@auth/api";
import { Injectable } from "@nestjs/common";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import {
	createGameInputSchema,
	declareDealWinsInputSchema,
	type GameIdInput,
	gameIdInputSchema,
	joinGameInputSchema,
	playCardInputSchema
} from "./callbreak.inputs.ts";
import { CallBreakMutations } from "./callbreak.mutations.ts";
import { CallBreakQueries } from "./callbreak.queries.ts";

@Injectable()
export class CallBreakRouter {

	private readonly trpc = initTRPC.context<{ authInfo: UserAuthInfo }>().create( { transformer: superjson } );

	constructor(
		private readonly queries: CallBreakQueries,
		private readonly mutations: CallBreakMutations,
		@OgmaLogger( CallBreakRouter ) private readonly logger: OgmaService
	) {}

	router() {
		return this.trpc.router( {
			createGame: this.trpc.procedure.input( createGameInputSchema )
				.mutation( ( { input, ctx } ) => this.mutations.createGame( input, ctx.authInfo ) ),

			joinGame: this.trpc.procedure.input( joinGameInputSchema )
				.mutation( ( { input, ctx } ) => this.mutations.joinGame( input, ctx.authInfo ) ),

			addBots: this.trpc.procedure.input( gameIdInputSchema )
				.use( this.gameDataMiddleware() )
				.mutation( ( { ctx } ) => this.mutations.addBots( ctx.game, ctx.players ) ),

			getGameData: this.trpc.procedure.input( gameIdInputSchema )
				.use( this.gameDataMiddleware() )
				.query( ( { ctx } ) => this.queries.getGameData( ctx.game, ctx.players, ctx.authInfo ) ),

			declareDealWins: this.trpc.procedure.input( declareDealWinsInputSchema )
				.use( this.gameDataMiddleware() )
				.mutation( ( { input, ctx } ) => {
					return this.mutations.declareDealWins( input, ctx.game, ctx.players, ctx.authInfo.id );
				} ),

			playCard: this.trpc.procedure.input( playCardInputSchema )
				.use( this.gameDataMiddleware() )
				.mutation( ( { input, ctx } ) => {
					return this.mutations.playCard( input, ctx.game, ctx.players, ctx.authInfo.id );
				} )
		} );
	}

	gameDataMiddleware() {
		return this.trpc.middleware( async opts => {

			const { gameId } = await opts.getRawInput() as GameIdInput;
			const authInfo = opts.ctx.authInfo;

			const { game, players } = await this.queries.getBaseGameData( gameId );

			if ( !players[ authInfo.id ] ) {
				this.logger.error( "Logged In User not part of this game! UserId: %s", authInfo.id );
				throw new TRPCError( { code: "BAD_REQUEST", message: "User not part of this game!" } );
			}

			return opts.next( { ctx: { game, players } } );
		} );
	}
}