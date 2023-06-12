import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RpcContext } from "../types";
import { LiteraturePlayer } from "@s2h/literature/core";

export const activePlayerDecoratorFn = ( _data: unknown, context: ExecutionContext ): LiteraturePlayer => {
	const { currentGame, authInfo } = context.switchToRpc().getContext<RpcContext>();
	return LiteraturePlayer.from( currentGame!.players[ authInfo!.id ] );
};

export const ActivePlayer = createParamDecorator( activePlayerDecoratorFn );