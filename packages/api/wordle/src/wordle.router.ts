import { Injectable } from "@nestjs/common";
import { LoggerFactory, TrpcService } from "@shared/api";
import { TRPCError } from "@trpc/server";
import { Messages } from "./wordle.constants.ts";
import { createGameInputSchema, type GameIdInput, gameIdInputSchema, makeGuessInputSchema } from "./wordle.inputs.ts";
import { WordleMutations } from "./wordle.mutations.ts";
import { WordleQueries } from "./wordle.queries.ts";

@Injectable()
export class WordleRouter {

	private readonly logger = LoggerFactory.getLogger( WordleRouter );

	constructor(
		private readonly trpc: TrpcService,
		private readonly queries: WordleQueries,
		private readonly mutations: WordleMutations
	) {}

	router() {
		return this.trpc.router( {
			createGame: this.trpc.procedure.input( createGameInputSchema )
				.mutation( ( { input, ctx } ) => this.mutations.createGame( input, ctx ) ),

			makeGuess: this.trpc.procedure.input( makeGuessInputSchema )
				.use( this.gameDataMiddleware( true ) )
				.mutation( ( { input, ctx } ) => this.mutations.makeGuess( input, ctx.game ) ),

			getGame: this.trpc.procedure.input( gameIdInputSchema )
				.use( this.gameDataMiddleware() )
				.query( ( { ctx: { game } } ) => game )
		} );
	}

	gameDataMiddleware( requireInProgress?: true ) {
		return this.trpc.middleware( async opts => {
			const { gameId } = await opts.getRawInput() as GameIdInput;
			const { authInfo } = opts.ctx;
			const game = await this.queries.getGameDate( gameId );

			if ( !game ) {
				this.logger.error( "Game Not Found! UserId: %s", authInfo.id );
				throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
			}

			if ( game.playerId !== authInfo.id ) {
				this.logger.error( "Logged In User is not playing this game! UserId: %s", authInfo.id );
				throw new TRPCError( { code: "FORBIDDEN", message: Messages.PLAYER_NOT_PART_OF_GAME } );
			}

			if ( requireInProgress && game.completedWords.length === game.words.length ) {
				this.logger.error( "Game Status is incorrect! GameId: %s", game.id );
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INCORRECT_STATUS } );
			}

			return opts.next( { ctx: { authInfo, game } } );
		} );
	}
}