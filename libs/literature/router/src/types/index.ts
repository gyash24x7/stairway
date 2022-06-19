import type { Publisher, TrpcContext, TrpcResolver } from "@s2h/utils";
import type { IEnhancedLitGame } from "@s2h/literature/utils";
import type { LitGame, LitMove, LitPlayer, LitTeam, Prisma } from "@prisma/client";
import type { LiteratureRouter } from "@s2h/literature/router";
import type { inferProcedureInput, inferProcedureOutput } from "@trpc/server";

export type LitTrpcContext = TrpcContext & {
	litGamePublisher: Publisher<IEnhancedLitGame>
}

export type LitResolver<I = unknown> = TrpcResolver<I, IEnhancedLitGame, LitTrpcContext>;

export type LitMoveDataWithoutDescription = Omit<Prisma.LitMoveUncheckedCreateInput, "description">;

export type LitGameData = LitGame & { players: LitPlayer[] } & { moves: LitMove[] } & { teams: LitTeam[] }

export type inferQueryOutput<TRouteKey extends keyof LiteratureRouter["_def"]["queries"],
	> = inferProcedureOutput<LiteratureRouter["_def"]["queries"][TRouteKey]>;

export type inferQueryInput<TRouteKey extends keyof LiteratureRouter["_def"]["queries"],
	> = inferProcedureInput<LiteratureRouter["_def"]["queries"][TRouteKey]>;

export type inferMutationOutput<TRouteKey extends keyof LiteratureRouter["_def"]["mutations"],
	> = inferProcedureOutput<LiteratureRouter["_def"]["mutations"][TRouteKey]>;

export type inferMutationInput<TRouteKey extends keyof LiteratureRouter["_def"]["mutations"],
	> = inferProcedureInput<LiteratureRouter["_def"]["mutations"][TRouteKey]>;