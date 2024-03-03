import { type AuthContext, LoggerFactory } from "@common/core";
import { Injectable } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import type { MiddlewareFunction } from "@trpc/server/unstable-core-do-not-import";
import type { Game, GameIdInput } from "@wordle/data";
import { GameDataQuery } from "../queries";
import { Messages } from "../utils";

type WordleContext = AuthContext & { gameData: Game, }
type MiddlewareFn<CtxIn, CtxOut> = MiddlewareFunction<CtxIn, any, CtxIn, CtxOut, any>;

@Injectable()
export class MiddlewareService {

	private readonly logger = LoggerFactory.getLogger( MiddlewareService );

	constructor( private readonly queryBus: QueryBus ) {}

	gameAndPlayerData(): MiddlewareFn<AuthContext, WordleContext> {
		return async opts => {
			const { gameId } = await opts.getRawInput() as GameIdInput;
			const { authUser } = opts.ctx;
			const gameDataQuery = new GameDataQuery( gameId );
			const gameData: Game | undefined = await this.queryBus.execute( gameDataQuery );

			if ( !gameData ) {
				this.logger.error( "Game Not Found! UserId: %s", authUser.id );
				throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
			}

			if ( gameData.playerId !== authUser.id ) {
				this.logger.error( "Logged In User is not playing this game! UserId: %s", authUser.id );
				throw new TRPCError( { code: "FORBIDDEN", message: Messages.PLAYER_NOT_PART_OF_GAME } );
			}

			return opts.next( { ctx: { authUser, gameData } } );
		};
	}

	validateGameInProgress(): MiddlewareFn<WordleContext, WordleContext> {
		return async ( { ctx, next } ) => {
			if ( ctx.gameData.completedWords.length === ctx.gameData.words.length ) {
				this.logger.error( "Game Status is incorrect! GameId: %s", ctx.gameData.id );
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INCORRECT_STATUS } );
			}

			return next( { ctx } );
		};
	}
}