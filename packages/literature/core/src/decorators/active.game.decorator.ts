import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { Constants } from "../constants";
import type { AggregatedGameData } from "@literature/data";

export const activeGameDecoratorFn = ( _data: unknown, context: ExecutionContext ): AggregatedGameData => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ Constants.ACTIVE_GAME ];
};

export const ActiveGame = createParamDecorator( activeGameDecoratorFn );