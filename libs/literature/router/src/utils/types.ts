import type { ILiteratureGame } from "@s2h/literature/utils";
import type { TrpcContext, TrpcMiddleware, TrpcResolverOptions } from "@s2h/utils";

export type LitTrpcContext = TrpcContext & { currentGame?: ILiteratureGame; }

export type LitTrpcMiddleware<R = any> = TrpcMiddleware<LitTrpcContext, R>

export type LitResolverOptions<I = unknown> = TrpcResolverOptions<I, LitTrpcContext>

export type LitResolver<I = unknown, O = unknown> = ( options: LitResolverOptions<I> ) => Promise<O>