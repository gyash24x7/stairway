import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { CallbreakDeal } from "@callbreak/data";
import type { Response } from "express";

export const activeDealDecoratorFn = ( _data: unknown, context: ExecutionContext ): CallbreakDeal => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ "currentDeal" ];
};

export const ActiveDeal = createParamDecorator( activeDealDecoratorFn );