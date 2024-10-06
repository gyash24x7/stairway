import type { UserAuthInfo } from "@auth/api";
import type {
	CallBreakCardMapping,
	CallBreakDeal,
	CallBreakGame,
	CallBreakPlayer,
	CallBreakRound,
	CallBreakStatus
} from "@prisma/client";

export type Player = CallBreakPlayer
export type CardMapping = CallBreakCardMapping
export type Game = CallBreakGame
export type Deal = CallBreakDeal
export type Round = CallBreakRound
export type Status = CallBreakStatus

export type PlayerData = Record<string, Player>;
export type DealWithRounds = Deal & { rounds: Round[] };

export type CallBreakGameData = { game: Game; players: PlayerData; }
export type AuthContext = { authInfo: UserAuthInfo };
export type CallBreakContext = AuthContext & CallBreakGameData;