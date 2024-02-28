import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { User } from "@supabase/supabase-js";
import type { Response } from "express";

export const AuthInfo = createParamDecorator(
	( _: unknown, context: ExecutionContext ): User => {
		const res = context.switchToHttp().getResponse<Response>();
		return res.locals[ "AuthInfo" ];
	}
);