import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { LiteratureGame, LiteraturePlayer } from "@literature/data";
import type { Response } from "express";
import type { UserAuthInfo } from "@auth/data";

export const activePlayerDecoratorFn = ( _data: unknown, context: ExecutionContext ): LiteraturePlayer => {
	const res = context.switchToHttp().getResponse<Response>();
	const currentGame: LiteratureGame = res.locals[ "currentGame" ];
	const authInfo: UserAuthInfo = res.locals[ "authInfo" ];
	return currentGame.players[ authInfo.id ];
};

export const ActivePlayer = createParamDecorator( activePlayerDecoratorFn );