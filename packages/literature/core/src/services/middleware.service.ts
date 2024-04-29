import { type AuthContext, LoggerFactory } from "@common/core";
import type { GameData, GameIdInput, GameStatus } from "@literature/data";
import { Injectable } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import type { MiddlewareFunction } from "@trpc/server/unstable-core-do-not-import";
import { GameDataQuery } from "../queries";
import { Messages } from "../utils";

export type LiteratureContext = AuthContext & { gameData: GameData };
type RequiredGameData = { status?: GameStatus, turn?: true };
type MiddlewareFn<CtxIn, CtxOut> = MiddlewareFunction<CtxIn, any, CtxIn, CtxOut, any>;

@Injectable()
export class MiddlewareService {

	private readonly logger = LoggerFactory.getLogger( MiddlewareService );

	constructor( private readonly queryBus: QueryBus ) {}

	gameAndPlayerData(): MiddlewareFn<AuthContext, LiteratureContext> {
		return async opts => {
			const { gameId } = await opts.getRawInput() as GameIdInput;
			const { authUser } = opts.ctx;
			const gameDataQuery = new GameDataQuery( gameId );
			const gameData: GameData | undefined = await this.queryBus.execute( gameDataQuery );

			if ( !gameData ) {
				this.logger.error( "Game Not Found! UserId: %s", authUser.id );
				throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
			}

			if ( !gameData.players[ authUser.id ] ) {
				this.logger.error( "Logged In User not part of this game! UserId: %s", authUser.id );
				throw new TRPCError( { code: "FORBIDDEN", message: Messages.PLAYER_NOT_PART_OF_GAME } );
			}

			return opts.next( { ctx: { authUser, gameData } } );
		};
	}

	validateStatusAndTurn( data: RequiredGameData ): MiddlewareFn<LiteratureContext, LiteratureContext> {
		return async ( { ctx, next } ) => {
			if ( !!data.status && ctx.gameData.status !== data.status ) {
				this.logger.error( "Game Status is not %s! GameId: %s", data.status, ctx.gameData.id );
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INCORRECT_STATUS } );
			}

			if ( !!data.turn && ctx.gameData.currentTurn !== ctx.authUser.id ) {
				this.logger.error( "It's not your turn! GameId: %s", ctx.gameData.id );
				throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_OUT_OF_TURN } );
			}

			return next( { ctx } );
		};
	}
}