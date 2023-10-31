import type { CardMappingData } from "@literature/types";
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { Constants } from "../constants";

export const cardMappingsDecoratorFn = ( _data: unknown, context: ExecutionContext ): CardMappingData => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ Constants.CARD_MAPPINGS ];
};

export const CardMappings = createParamDecorator( cardMappingsDecoratorFn );