import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	GetTableStateApiEndpoint,
	JoinApiEndpoint,
	StartApiEndpoint,
	MoveApiEndpoint
} from "@/shared/swish/api.ts";
import {
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	SplendorSnapshot
} from "@/games/splendor/shared/schema.ts";

export const SplendorApiGroup = HttpApiGroup.make( "splendor" )
	.add(
		CreateGameApiEndpoint( SplendorConfig ),
		GetStateApiEndpoint( SplendorSnapshot ),
		GetTableStateApiEndpoint( SplendorSnapshot ),
		JoinApiEndpoint(),
		StartApiEndpoint(),
		MoveApiEndpoint( "pickTokens", PickTokensInput ),
		MoveApiEndpoint( "reserveCard", ReserveCardInput ),
		MoveApiEndpoint( "purchaseCard", PurchaseCardInput )
	)
	.prefix( "/splendor" )
	.middleware( AuthMiddleware );
