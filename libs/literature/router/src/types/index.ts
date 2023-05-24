import type { ILiteratureGame } from "@s2h/literature/utils";
import type { TrpcContext, TrpcMiddleware, TrpcResolverOptions, UsersR } from "@s2h/utils";
import type { Observable } from "@trpc/server/observable";
import type { R, RTable } from "rethinkdb-ts";

export type LiteratureR = UsersR & { literature: () => RTable<ILiteratureGame> };

export type LitTrpcContext = TrpcContext & {
	currentGame?: ILiteratureGame;
	db: R & LiteratureR
}

export type LitTrpcMiddleware<R = any> = TrpcMiddleware<LitTrpcContext, R>

export type LitResolverOptions<I = unknown> = TrpcResolverOptions<I, LitTrpcContext>

export type LitResolver<I = unknown, O = unknown> = ( options: LitResolverOptions<I> ) => Promise<O> | Observable<O, unknown>

export type LitSubscriptionResolver<I = unknown, O = unknown> = ( options: LitResolverOptions<I> ) => Observable<O, any>