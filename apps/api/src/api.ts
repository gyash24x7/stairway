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

import { AuthApi } from "@s2h/auth/api";
import { CallbreakApiGroup } from "@s2h/callbreak/api";
import { FishApi } from "@s2h/fish/api";
import { KingdominoApi } from "@s2h/kingdomino/api";
import { SplendorApi } from "@s2h/splendor/api";
import { TicTacToeApi } from "@s2h/tictactoe/api";
import { WordleApi } from "@s2h/wordle/api";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import { HealthApi } from "./health";

export class StairwayAPI extends HttpApi.make( "api" )
	.addHttpApi( HealthApi )
	.addHttpApi( AuthApi )
	.addHttpApi( WordleApi )
	.addHttpApi( TicTacToeApi )
	.addHttpApi( SplendorApi )
	.addHttpApi( FishApi )
	.addHttpApi( CallbreakApiGroup )
	.addHttpApi( KingdominoApi ) {}
