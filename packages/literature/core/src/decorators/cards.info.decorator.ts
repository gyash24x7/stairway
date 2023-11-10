import type { CardsData } from "@literature/types";
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { Constants } from "../constants";

export const cardsInfoDecoratorFn = ( _data: unknown, context: ExecutionContext ): CardsData => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ Constants.CARD_MAPPINGS ];
};

export const CardsInfo = createParamDecorator( cardsInfoDecoratorFn );