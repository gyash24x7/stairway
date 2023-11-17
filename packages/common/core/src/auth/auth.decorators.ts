import { createParamDecorator, ExecutionContext, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Response } from "express";
import { Constants } from "./auth.constants";
import { AuthGuard } from "./auth.guard";

export const authUserDecoratorFn = ( _data: unknown, context: ExecutionContext ): User => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ Constants.AUTH_USER ]!;
};

export const AuthUser = createParamDecorator( authUserDecoratorFn );

export const RequiresAuth = () => UseGuards( AuthGuard );
