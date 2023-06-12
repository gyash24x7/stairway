import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RpcContext } from "../types";
import { LiteratureGame } from "@s2h/literature/core";

export const activeGameDecoratorFn = ( _data: unknown, context: ExecutionContext ): LiteratureGame => {
	const { currentGame } = context.switchToRpc().getContext<RpcContext>();
	return LiteratureGame.from( currentGame! );
};

export const ActiveGame = createParamDecorator( activeGameDecoratorFn );