import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import type { UserAuthInfo } from "@auth/types";
import { Constants } from "../constants";

export const authInfoDecoratorFn = ( _data: unknown, context: ExecutionContext ): UserAuthInfo => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ Constants.AUTH_INFO ]!;
};

export const AuthInfo = createParamDecorator( authInfoDecoratorFn );