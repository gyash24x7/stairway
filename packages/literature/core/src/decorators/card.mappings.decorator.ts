import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { Constants } from "../constants";
import type { CardMappingData } from "@literature/types";

export const cardMappingsDecoratorFn = ( _data: unknown, context: ExecutionContext ): CardMappingData => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ Constants.PLAYER_DATA ];
};

export const CardMappings = createParamDecorator( cardMappingsDecoratorFn );