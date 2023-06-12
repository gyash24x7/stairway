import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { JwtService } from "./jwt.service";
import { Request, Response } from "express";
import { Database } from "@s2h/utils";
import { Db, UserAuthInfo } from "./auth.types";
import { Metadata } from "@grpc/grpc-js";

@Injectable()
export class AuthGuard implements CanActivate {

	constructor(
		@Database() private readonly db: Db,
		private readonly jwtService: JwtService
	) {}

	async canActivate( context: ExecutionContext ) {
		let authInfo: UserAuthInfo | null = null;

		switch ( context.getType() ) {
			case "http":
				const gqlContext = GqlExecutionContext.create( context );
				const ctx = gqlContext.getContext<{ req: Request; res: Response }>();

				const authCookie: string = ctx.req.cookies[ "auth-cookie" ];
				const payload = await this.jwtService.verify( authCookie );

				if ( !!payload?.sub ) {
					authInfo = await this.db.users().findOne( { id: payload.sub } );
					ctx.res.locals[ "authInfo" ] = authInfo;
				}
				break;

			case "rpc":
				const rpcContext = context.switchToRpc().getContext();
				const metadata: Metadata = context.getArgByIndex( 1 );
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