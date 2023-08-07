import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import type { UserAuthInfo } from "@auth/data";

export const authInfoDecoratorFn = ( _data: unknown, context: ExecutionContext ): UserAuthInfo => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ "authInfo" ]!;
};

export const AuthInfo = createParamDecorator( authInfoDecoratorFn );