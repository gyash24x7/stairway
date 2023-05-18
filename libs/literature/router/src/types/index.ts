import { ILiteratureGame } from "@s2h/literature/utils";
import type { Publisher, TrpcContext, TrpcMiddleware, TrpcResolverOptions } from "@s2h/utils";
import { RTable } from "rethinkdb-ts";

export type LitTrpcContext = TrpcContext & {
	litGamePublisher: Publisher<ILiteratureGame>,
	currentGame?: ILiteratureGame
	literatureTable: RTable<ILiteratureGame>;
}

export type LitTrpcMiddleware<R = any> = TrpcMiddleware<LitTrpcContext, R>

export type LitResolverOptions<I = unknown> = TrpcResolverOptions<I, LitTrpcContext>