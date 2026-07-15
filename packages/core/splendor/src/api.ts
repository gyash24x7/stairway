// @s2h/splendor/api — the Effect v4 HttpApi surface for Splendor.
//
// The shared engine lifecycle + the three moves + undo/redo, assembled by
// `defineEngineApi`. Definition only (handlers live in the serving app);
// pure/browser-safe.

import { GameApiGroup, MoveApiEndpoint } from "@s2h/swish/api";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import {
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	SplendorSnapshot
} from "./schema";

export class SplendorApi extends HttpApi.make( "splendor" ).add(
	GameApiGroup( "splendor", {
		config: SplendorConfig,
		snapshot: SplendorSnapshot,
		moves: [
			MoveApiEndpoint( "pickTokens", PickTokensInput ),
			MoveApiEndpoint( "reserveCard", ReserveCardInput ),
			MoveApiEndpoint( "purchaseCard", PurchaseCardInput )
		]
	} )
) {}
