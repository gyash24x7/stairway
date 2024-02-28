import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import type { User } from "./auth.utils";

export const AuthInfo = createParamDecorator(
	( _: unknown, context: ExecutionContext ): User => {
		const res = context.switchToHttp().getResponse<Response>();
		return res.locals[ "AuthInfo" ];
	}
);