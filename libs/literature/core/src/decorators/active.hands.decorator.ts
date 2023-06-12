import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RpcContext } from "../types";
import { CardHand } from "@s2h/cards";

export const activeGameHandsDecoratorFn = ( _data: unknown, context: ExecutionContext ): Record<string, CardHand> => {
	const { currentGameHands = {} } = context.switchToRpc().getContext<RpcContext>();

	const hands: Record<string, CardHand> = {};
	Object.keys( currentGameHands ).map( playerId => {
		hands[ playerId ] = CardHand.from( currentGameHands[ playerId ] );
	} );

	return hands;
};

export const ActiveGameHands = createParamDecorator( activeGameHandsDecoratorFn );