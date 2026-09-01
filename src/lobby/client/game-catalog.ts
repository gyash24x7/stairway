import { callbreakApi } from "@/games/callbreak/client/client.ts";
import { coupApi } from "@/games/coup/client/client.ts";
import { fishApi } from "@/games/fish/client/client.ts";
import { kingdominoApi } from "@/games/kingdomino/client/client.ts";
import { splendorApi } from "@/games/splendor/client/client.ts";
import { tictactoeApi } from "@/games/tictactoe/client/client.ts";
import { wordleApi } from "@/games/wordle/client/client.ts";

import type { GameRef, JoinGameInput } from "@/swish/shared/schema.ts";

type CatalogEntry = {
	/** What a row calls the game. */
	readonly label: string;
	/** That game's own join endpoint. */
	readonly join: ( input: JoinGameInput ) => Promise<GameRef>;
};

/**
 * The kinds this client can seat somebody at, and how.
 *
 * A listing spans every game but joining does not — the six join endpoints are
 * six endpoints, each with its own types — so a row that wants a Join button has
 * to dispatch on the kind the server named. This map is that dispatch.
 *
 * A kind the server lists and this map does not know is rendered without a Join
 * button rather than throwing, which is what lets the worker ship a seventh game
 * before the client has caught up.
 *
 * Deliberately not the source of the landing page's tiles: that page names its
 * games as a static list precisely so it can be rendered without pulling in six
 * client modules, and pointing it here would undo that.
 */
export const GAME_CATALOG: Record<string, CatalogEntry | undefined> = {
	callbreak: { label: "CALLBREAK", join: callbreakApi.join },
	coup: { label: "COUP", join: coupApi.join },
	fish: { label: "FISH", join: fishApi.join },
	kingdomino: { label: "KINGDOMINO", join: kingdominoApi.join },
	splendor: { label: "SPLENDOR", join: splendorApi.join },
	tictactoe: { label: "TIC TAC TOE", join: tictactoeApi.join },
	wordle: { label: "WORDLE", join: wordleApi.join }
};
