import type { ILiteratureGame } from "@s2h/literature/utils";
import type { TrpcContext, TrpcMiddleware, TrpcResolverOptions } from "@s2h/utils";

export type LiteratureTrpcContext = TrpcContext & { currentGame?: ILiteratureGame; }

export type LiteratureTrpcMiddleware<R = any> = TrpcMiddleware<LiteratureTrpcContext, R>

export type LiteratureResolverOptions<I = unknown> = TrpcResolverOptions<I, LiteratureTrpcContext>

export type LiteratureResolver<I = unknown, O = unknown> = ( options: LiteratureResolverOptions<I> ) => Promise<O>