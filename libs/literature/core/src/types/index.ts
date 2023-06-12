import { Collection } from "mongodb";
import { ILiteratureGame, ILiteratureGameHand, ILiteratureMove } from "@s2h/literature/core";
import { ICardHand } from "@s2h/cards";
import { UserAuthInfo } from "@s2h/auth";

export type Db = {
	games: () => Collection<ILiteratureGame>,
	moves: () => Collection<ILiteratureMove<any>>,
	hands: () => Collection<ILiteratureGameHand>
}

export type RpcContext = {
	authInfo?: UserAuthInfo | null;
	currentGame?: ILiteratureGame | null;
	currentGameHands?: Record<string, ICardHand>;
}