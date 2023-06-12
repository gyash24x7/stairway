import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { UserAuthInfo } from "./auth.types";

export const authInfoDecoratorFn = ( _data: unknown, context: ExecutionContext ): UserAuthInfo => {
	switch ( context.getType() ) {
		case "http":
			return { id: "", name: "", avatar: "", verified: true };

		case "rpc":
			const rpcContext = context.switchToRpc().getContext();
			return rpcContext.authInfo;

		case "ws":
			return { id: "", name: "", avatar: "", verified: true };
	}
};

export const AuthInfo = createParamDecorator( authInfoDecoratorFn );