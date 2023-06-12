import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Database, LoggerFactory } from "@s2h/utils";
import type { Db, RpcContext } from "../types";
import { Metadata } from "@grpc/grpc-js";

@Injectable()
export class RequireGameGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( RequireGameGuard );

	constructor( @Database() private readonly db: Db ) {}

	async canActivate( context: ExecutionContext ) {
		const rpcContext = context.switchToRpc().getContext<RpcContext>();

		const metadata: Metadata = context.getArgByIndex( 1 );
		this.logger.debug( "Metadata: %o", metadata.toJSON() );

		const [ gameId ] = metadata.get( "gameId" );
		const game = await this.db.games().findOne( { id: gameId } );
		rpcContext.currentGame = game;

		return !!game;
	}
}