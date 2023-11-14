import type { CardsData } from "@literature/types";
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { Constants } from "../constants";

export const cardsInfoDecoratorFn = ( _data: unknown, context: ExecutionContext ): CardsData => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ Constants.CARDS_DATA ];
};

export const CardsInfo = createParamDecorator( cardsInfoDecoratorFn );