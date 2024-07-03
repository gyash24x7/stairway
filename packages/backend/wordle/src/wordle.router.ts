import { type AuthContext, LoggerFactory, type MiddlewareFn, TrpcService, type UserAuthInfo } from "@backend/utils";
import { Injectable } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CreateGameCommand, MakeGuessCommand } from "./commands";
import { GameDataQuery } from "./queries";
import { Messages } from "./wordle.constants.ts";
import type { Game } from "./wordle.schema.ts";

type GameIdInput = { gameId: string };
type WordleContext = { gameData: Game, authInfo: UserAuthInfo }

@Injectable()
export class WordleRouter {

	private readonly logger = LoggerFactory.getLogger( WordleRouter );

	constructor(
		private readonly trpc: TrpcService,
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus
	) {}

	createContext() {
		return this.trpc.createContextFn;
	}

	router() {
		return this.trpc.router( {
			createGame: this.trpc.authenticatedProcedure
				.input( z.object( { wordCount: z.number().optional(), wordLength: z.number().optional() } ) )
				.mutation( ( { input, ctx: { authInfo } } ) => {
					const command = new CreateGameCommand( input, authInfo );
					return this.commandBus.execute<CreateGameCommand, Game>( command );
				} ),

			makeGuess: this.trpc.authenticatedProcedure
				.input( z.object( { gameId: z.string().cuid2(), guess: z.string() } ) )
				.use( this.gameDataMiddleware() )
				.use( this.validationMiddleware() )
				.mutation( ( { input, ctx: { gameData } } ) => {
					const command = new MakeGuessCommand( input, gameData );
					return this.commandBus.execute<MakeGuessCommand, Game>( command );
				} ),

			getGame: this.trpc.authenticatedProcedure
				.input( z.object( { gameId: z.string().cuid2() } ) )
				.use( this.gameDataMiddleware() )
				.query( ( { ctx: { gameData } } ) => gameData )
		} );
	}

	gameDataMiddleware(): MiddlewareFn<AuthContext, WordleContext> {
		return async opts => {
			const { gameId } = await opts.getRawInput() as GameIdInput;
			const { authInfo } = opts.ctx;
			const gameDataQuery = new GameDataQuery( gameId );
			const gameData: Game | undefined = await this.queryBus.execute( gameDataQuery );

			if ( !gameData ) {
				this.logger.error( "Game Not Found! UserId: %s", authInfo.id );
				throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
			}

			if ( gameData.playerId !== authInfo.id ) {
				this.logger.error( "Logged In User is not playing this game! UserId: %s", authInfo.id );
				throw new TRPCError( { code: "FORBIDDEN", message: Messages.PLAYER_NOT_PART_OF_GAME } );
			}

			return opts.next( { ctx: { authInfo, gameData } } );
		};
	}

	validationMiddleware(): MiddlewareFn<WordleContext, WordleContext> {
		return async ( { ctx, next } ) => {
			if ( ctx.gameData.completedWords.length === ctx.gameData.words.length ) {
				this.logger.error( "Game Status is incorrect! GameId: %s", ctx.gameData.id );
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INCORRECT_STATUS } );
			}

			return next( { ctx } );
		};
	}
}