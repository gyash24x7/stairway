import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { LoggerFactory } from "@s2h/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { RpcContext } from "../types";

@Injectable()
export class RequirePlayerGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequirePlayerGuard );

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

		if ( !ctx.currentGame.players[ ctx.authInfo.id ] ) {
			this.logger.trace( "Game: %o", ctx.currentGame );
			this.logger.error( "Logged In User not part of this game! UserId: %s", ctx.authInfo.id );
			throw new TRPCError( { code: "FORBIDDEN", message: Messages.NOT_PART_OF_GAME } );
		}

		return true;
	}


}