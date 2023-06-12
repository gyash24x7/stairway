import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { UserAuthInfo } from "./auth.types";
import { Metadata } from "@grpc/grpc-js";
import { LoggerFactory } from "@s2h/utils";

@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = LoggerFactory.getLogger( AuthGuard );

	constructor() {}

	async canActivate( context: ExecutionContext ) {
		let authInfo: UserAuthInfo | null = null;

		switch ( context.getType() ) {
			case "rpc":
				const rpcContext = context.switchToRpc().getContext();
				const metadata: Metadata = context.getArgByIndex( 1 );
				this.logger.debug( "Metadata: %o", metadata.toJSON() );
				const [ authInfoString ] = metadata.get( "authInfo" );
				if ( !!authInfoString ) {
					authInfo = JSON.parse( authInfoString as string );
					rpcContext.authInfo = authInfo;
				}
				break;
		}

		return !!authInfo;
	}

}