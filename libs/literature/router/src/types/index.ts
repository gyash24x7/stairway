import type { Publisher, TrpcContext, TrpcMiddlewareOptions, TrpcResolverOptions } from "@s2h/utils";
import type { EnhancedLitGame, IEnhancedLitGame } from "@s2h/literature/utils";
import type { LitGame, LitMove, LitPlayer, LitTeam } from "@prisma/client";
import type { LiteratureRouter } from "@s2h/literature/router";
import type { inferProcedureInput } from "@trpc/server";

export type LitTrpcMiddlewareOptions = TrpcMiddlewareOptions<LitTrpcContext>;

export type LitTrpcContext = TrpcContext & {
	litGamePublisher: Publisher<IEnhancedLitGame>,
	currentGame?: EnhancedLitGame
}

export type LitResolverOptions<I = unknown> = TrpcResolverOptions<I, LitTrpcContext>

export type LitGameData = LitGame & { players: LitPlayer[] } & { moves: LitMove[] } & { teams: LitTeam[] };

export type InferQueryInput<TRouteKey extends keyof LiteratureRouter["_def"]["queries"],
	> = inferProcedureInput<LiteratureRouter["_def"]["queries"][TRouteKey]>;

export type InferMutationInput<TRouteKey extends keyof LiteratureRouter["_def"]["mutations"],
	> = inferProcedureInput<LiteratureRouter["_def"]["mutations"][TRouteKey]>;