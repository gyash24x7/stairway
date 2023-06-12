import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { RpcContext } from "../types";

@Injectable()
export class RequireTurnGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireTurnGuard );

	canActivate( context: ExecutionContext ) {
		this.logger.debug( ">> requirePlayer()" );
		const ctx = context.switchToRpc().getContext<RpcContext>();

		if ( !ctx.authInfo ) {
			this.logger.error( "User Not Logged In!" );
			throw new TRPCError( { code: "UNAUTHORIZED", message: Messages.USER_NOT_LOGGED_IN } );
		}

		if ( !ctx.currentGame ) {
			this.logger.error( "Game Not Present!" );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		if ( ctx.currentGame.currentTurn !== ctx.authInfo.id ) {
			this.logger.trace( "Game: %o", ctx.currentGame );
			this.logger.error( "It is not logged in User's turn! UserId: %s", ctx.authInfo.id );
			throw new TRPCError( { code: "FORBIDDEN", message: Messages.OUT_OF_TURN } );
		}

		return true;
	}


}