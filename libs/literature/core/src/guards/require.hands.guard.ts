import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { ICardHand } from "@s2h/cards";
import type { Db, RpcContext } from "../types";
import { Database, LoggerFactory } from "@s2h/utils";

@Injectable()
export class RequireHandsGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireHandsGuard );

	constructor( @Database() private readonly db: Db ) {}

	async canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> requireHands()" );
		const ctx = context.switchToRpc().getContext<RpcContext>();

		if ( !ctx.authInfo ) {
			this.logger.error( "User Not Logged In!" );
			throw new TRPCError( { code: "UNAUTHORIZED", message: Messages.USER_NOT_LOGGED_IN } );
		}

		if ( !ctx.currentGame ) {
			this.logger.error( "Game Not Present!" );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		const hands = await this.db.hands().find( { gameId: ctx.currentGame.id } );
		const currentGameHands: Record<string, ICardHand> = {};

		let handCount = 0;
		for await ( const hand of hands ) {
			currentGameHands[ hand.playerId ] = hand.hand;
			handCount++;
		}

		if ( handCount !== 6 ) {
			this.logger.trace( "Game: %o", ctx.currentGame );
			this.logger.error( "Hands Not Present! GameId: %s", ctx.currentGame.id );
			throw new TRPCError( { code: "FORBIDDEN", message: Messages.HANDS_NOT_PRESENT } );
		}

		ctx.currentGameHands = currentGameHands;
		return true;
	}


}