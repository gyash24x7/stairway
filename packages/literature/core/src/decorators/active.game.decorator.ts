import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import type { LiteratureGame } from "@literature/data";
import { Constants } from "../constants";

export const activeGameDecoratorFn = ( _data: unknown, context: ExecutionContext ): LiteratureGame => {
	const res = context.switchToHttp().getResponse<Response>();
	return res.locals[ Constants.ACTIVE_GAME ];
};

export const ActiveGame = createParamDecorator( activeGameDecoratorFn );