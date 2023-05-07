import type { LitGame, LitMove, LitPlayer, LitTeam } from "@prisma/client";
import type { EnhancedLitGame, IEnhancedLitGame } from "@s2h/literature/utils";
import type { Publisher, TrpcContext, TrpcMiddlewareOptions, TrpcResolverOptions } from "@s2h/utils";

export type LitTrpcMiddlewareOptions = TrpcMiddlewareOptions<LitTrpcContext>;

export type LitTrpcContext = TrpcContext & {
	litGamePublisher: Publisher<IEnhancedLitGame>,
	currentGame?: EnhancedLitGame
}

export type LitResolverOptions<I = unknown> = TrpcResolverOptions<I, LitTrpcContext>

export type LitGameData = LitGame & { players: LitPlayer[] } & { moves: LitMove[] } & { teams: LitTeam[] };