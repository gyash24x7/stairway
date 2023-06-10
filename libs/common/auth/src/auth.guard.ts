import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { JwtService } from "./jwt.service";
import { Request, Response } from "express";
import { Database } from "@s2h/utils";
import { WithId } from "mongodb";
import { Db, IUser } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {

	constructor(
		@Database() private readonly db: Db,
		private readonly jwtService: JwtService
	) {}

	async canActivate( context: ExecutionContext ) {
		const gqlContext = GqlExecutionContext.create( context );
		const ctx = gqlContext.getContext<{ req: Request; res: Response }>();

		const authCookie: string = ctx.req.cookies[ "auth-cookie" ];
		const payload = await this.jwtService.verify( authCookie );
		let authUser: WithId<IUser> | null = null;

		if ( !!payload?.sub ) {
			authUser = await this.db.users().findOne( { id: payload.sub } );
			ctx.res.locals[ "authUser" ] = authUser;
		}

		return !!authUser;
	}

}