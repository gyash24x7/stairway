// The composed Stairway HttpApi *definition* (browser-safe).
//
// This module composes every game/auth/health HttpApi group into one root
// `StairwayAPI`. It imports ONLY the pure endpoint-group definitions (schemas +
// endpoint shapes) — never handlers, Durable Objects, `db`, or `alchemy`. That
// keeps it importable from the browser client (`./client` -> `@s2h/api/client`)
// without dragging server-only code into the SPA's type graph.
//
// The handler implementations live in `./handlers` (games + health) and
// `./auth` (the WebAuthn/session flows), and are wired up by `./worker`.

import { AuthApiGroup } from "@s2h/auth/api";
import { CallbreakApiGroup } from "@s2h/callbreak/api";
import { FishApiGroup } from "@s2h/fish/api";
import { KingdominoApiGroup } from "@s2h/kingdomino/api";
import { SplendorApiGroup } from "@s2h/splendor/api";
import { TicTacToeApiGroup } from "@s2h/tictactoe/api";
import { WordleApiGroup } from "@s2h/wordle/api";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import { HealthApiGroup } from "./health";

export class StairwayAPI extends HttpApi.make( "api" )
	.prefix( "/auth" )
	.add( HealthApiGroup )
	.add( AuthApiGroup )
	.add( WordleApiGroup )
	.add( TicTacToeApiGroup )
	.add( SplendorApiGroup )
	.add( FishApiGroup )
	.add( CallbreakApiGroup )
	.add( KingdominoApiGroup ) {}
