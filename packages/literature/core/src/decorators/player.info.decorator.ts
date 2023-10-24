import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { Constants } from "../constants";
import type { PlayerSpecificData } from "@literature/types";

export const playerInfoDecoratorFn = ( _data: unknown, context: ExecutionContext ): PlayerSpecificData => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ Constants.PLAYER_DATA ];
};

export const PlayerInfo = createParamDecorator( playerInfoDecoratorFn );