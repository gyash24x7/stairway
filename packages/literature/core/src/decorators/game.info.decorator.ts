import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { Constants } from "../constants";
import type { GameData } from "@literature/types";

export const gameInfoDecoratorFn = ( _data: unknown, context: ExecutionContext ): GameData => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ Constants.GAME_DATA ];
};

export const GameInfo = createParamDecorator( gameInfoDecoratorFn );