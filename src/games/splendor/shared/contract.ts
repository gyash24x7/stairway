import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	ClaimNobleInput,
	PassInput,
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	SplendorCreateInput,
	SplendorView
} from "@/games/splendor/shared/schema.ts";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetViewApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint,
	RedoApiEndpoint,
	SetAutoPlayApiEndpoint,
	StartApiEndpoint,
	UndoApiEndpoint
} from "@/swish/shared/contract.ts";

export const SplendorApiGroup = HttpApiGroup.make( "splendor" )
	.add(
		CreateGameApiEndpoint( SplendorCreateInput ),
		GetViewApiEndpoint( SplendorView, SplendorConfig ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		StartApiEndpoint(),
		MoveApiEndpoint( "pickTokens", PickTokensInput ),
		MoveApiEndpoint( "reserveCard", ReserveCardInput ),
		MoveApiEndpoint( "purchaseCard", PurchaseCardInput ),
		MoveApiEndpoint( "pass", PassInput ),
		MoveApiEndpoint( "claimNoble", ClaimNobleInput ),
		SetAutoPlayApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.prefix( "/splendor" )
	.middleware( AuthMiddleware );
