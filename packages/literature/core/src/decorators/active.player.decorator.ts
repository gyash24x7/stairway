import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { LiteratureGame, LiteraturePlayer } from "@literature/data";
import type { Response } from "express";
import type { UserAuthInfo } from "@auth/data";
import { Constants } from "../constants";

export const activePlayerDecoratorFn = ( _data: unknown, context: ExecutionContext ): LiteraturePlayer => {
	const res = context.switchToHttp().getResponse<Response>();
	const currentGame: LiteratureGame = res.locals[ Constants.ACTIVE_GAME ];
	const authInfo: UserAuthInfo = res.locals[ Constants.AUTH_INFO ];
	console.log( res.locals );
	return currentGame.players[ authInfo.id ];
};

export const ActivePlayer = createParamDecorator( activePlayerDecoratorFn );