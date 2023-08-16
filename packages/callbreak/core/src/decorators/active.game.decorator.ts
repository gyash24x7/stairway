import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import type { CallbreakGame } from "@callbreak/data";

export const activeGameDecoratorFn = ( _data: unknown, context: ExecutionContext ): CallbreakGame => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ "currentGame" ];
};

export const ActiveGame = createParamDecorator( activeGameDecoratorFn );