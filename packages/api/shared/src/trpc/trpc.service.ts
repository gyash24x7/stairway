import { Injectable } from "@nestjs/common";
import { initTRPC } from "@trpc/server";
import type { MiddlewareFunction } from "@trpc/server/unstable-core-do-not-import";

export type MiddlewareFn<CtxIn, CtxOut> = MiddlewareFunction<CtxIn, any, CtxIn, CtxOut, any>;

type UserAuthInfo = {
	id: string;
	name: string;
	avatar: string;
};

export type AuthContext = {
	authInfo: UserAuthInfo;
}

@Injectable()
export class TrpcService {
	private t = initTRPC.context<AuthContext>().create();

	get router() {
		return this.t.router;
	}

	get procedure() {
		return this.t.procedure;
	}

	get middleware() {
		return this.t.middleware;
	}
}
