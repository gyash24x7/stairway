import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { CallbreakGame, CallbreakPlayer } from "@callbreak/data";
import type { Response } from "express";
import type { UserAuthInfo } from "@auth/data";

export const activePlayerDecoratorFn = ( _data: unknown, context: ExecutionContext ): CallbreakPlayer => {
	const res = context.switchToHttp().getResponse<Response>();
	const currentGame: CallbreakGame = res.locals[ "currentGame" ];
	const authInfo: UserAuthInfo = res.locals[ "authInfo" ];
	return currentGame.players[ authInfo.id ];
};

export const ActivePlayer = createParamDecorator( activePlayerDecoratorFn );