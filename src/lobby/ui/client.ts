import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Atom from "effect/reactivity/Atom";
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi";

import { LobbyApi } from "@/lobby/contract";


export class ApiClient extends AtomHttpApi.Service<ApiClient>()(
	"lobby/ApiClient",
	{ api: LobbyApi, httpClient: FetchHttpClient.layer }
) {}

/** The family's key for "every game", since a family cannot be keyed on nothing. */
export const ALL_GAMES = "";

/**
 * The tables still looking for players, for one game or for all of them.
 *
 * A plain query rather than a subscription, because a lobby is a list somebody
 * reads for a few seconds before leaving it. The games it names each have their
 * own live view once you are sitting at one, and holding an SSE connection open
 * for every browsing visitor would cost far more than the page is worth.
 *
 * It refetches whenever it is mounted, which is most of what keeps it honest —
 * joining a table navigates away from the list, so coming back builds it again
 * — and `OpenTables` puts a refresh within reach for the rest.
 *
 * A family rather than one atom, because `/tictactoe` and `/tables` ask
 * different questions and must not share an answer: keyed on the game name,
 * each list is cached and refreshed on its own.
 */
export const openTablesAtom = Atom.family( ( game: string ) =>
	ApiClient.query( "lobby", "openTables", {
		query: game === ALL_GAMES ? {} : { game },
		reactivityKeys: [ "open-tables" ]
	} ) );
