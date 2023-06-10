import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { IUser } from "./auth.types";
import { Request, Response } from "express";

export const authUserDecoratorFn = ( _data: unknown, context: ExecutionContext ): IUser => {
	const gqlContext = GqlExecutionContext.create( context );
	const ctx = gqlContext.getContext<{ req: Request; res: Response; }>();
	return ctx.res.locals[ "authInfo" ];
};

export const AuthUser = createParamDecorator( authUserDecoratorFn );