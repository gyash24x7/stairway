import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { LiteratureGameStatus } from "@s2h/literature/core";
import { LoggerFactory } from "@s2h/utils";
import { RpcContext } from "../types";

@Injectable()
export class RequireActiveGameGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireActiveGameGuard );

	async canActivate( context: ExecutionContext ) {
		const rpcContext = context.switchToRpc().getContext<RpcContext>();

		if ( !rpcContext.currentGame ) {
			this.logger.error( "Game Not Present!" );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		if ( rpcContext.currentGame.status !== LiteratureGameStatus.IN_PROGRESS ) {
			this.logger.debug( "Game Present but not in progress!" );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
		}

		return true;
	}
}