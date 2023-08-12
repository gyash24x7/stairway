import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { CardHand } from "@s2h/cards";
import type { Response } from "express";

export const activeGameHandsDecoratorFn = ( _data: unknown, context: ExecutionContext ): Record<string, CardHand> => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ "currentGameHands" ] ?? {};
};

export const ActiveGameHands = createParamDecorator( activeGameHandsDecoratorFn );