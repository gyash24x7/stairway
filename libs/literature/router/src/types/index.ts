import type { LitGame, LitMove, LitPlayer, LitTeam } from "@prisma/client";
import type { EnhancedLitGame, IEnhancedLitGame } from "@s2h/literature/utils";
import type { Publisher, TrpcContext, TrpcMiddleware, TrpcResolverOptions } from "@s2h/utils";

export type LitTrpcContext = TrpcContext & {
	litGamePublisher: Publisher<IEnhancedLitGame>,
	currentGame?: EnhancedLitGame
}

export type LitTrpcMiddleware<R = any> = TrpcMiddleware<LitTrpcContext, R>

export type LitResolverOptions<I = unknown> = TrpcResolverOptions<I, LitTrpcContext>

export type LitGameData = LitGame & { players: LitPlayer[] } & { moves: LitMove[] } & { teams: LitTeam[] };