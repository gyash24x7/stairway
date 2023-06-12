import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { UserAuthInfo } from "./auth.types";
import { Request, Response } from "express";

export const authInfoDecoratorFn = ( _data: unknown, context: ExecutionContext ): UserAuthInfo => {
	switch ( context.getType() ) {
		case "http":
			const gqlContext = GqlExecutionContext.create( context );
			const ctx = gqlContext.getContext<{ req: Request; res: Response; }>();
			return ctx.res.locals[ "authInfo" ];

		case "rpc":
			const rpcContext = context.switchToRpc().getContext();
			return rpcContext.authInfo;

		case "ws":
			return { id: "", name: "", avatar: "", verified: true };
	}
};

export const AuthInfo = createParamDecorator( authInfoDecoratorFn );