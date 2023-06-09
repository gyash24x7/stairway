import type { ILiteratureGame } from "@s2h/literature/utils";
import type { TrpcContext, TrpcMiddleware, TrpcResolverOptions } from "@s2h/utils";
import { Publisher } from "@s2h/utils";
import { Db } from "./db";
import { ICardHand } from "@s2h/cards";

export type LiteratureTrpcContext = TrpcContext & {
	currentGame?: ILiteratureGame;
	currentGameHands?: Record<string, ICardHand>;
	db: Db,
	publisher: Publisher<ILiteratureGame>
};

export type LiteratureTrpcMiddleware<R = any> = TrpcMiddleware<LiteratureTrpcContext, R>

export type LiteratureResolverOptions<I = unknown> = TrpcResolverOptions<I, LiteratureTrpcContext>

export type LiteratureResolver<I = unknown, O = unknown> = ( options: LiteratureResolverOptions<I> ) => Promise<O>