import { AuthMiddleware } from "@/auth/shared/middleware";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint
} from "@/shared/swish/api";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import {
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	SplendorSnapshot
} from "./schema";

export const SplendorApiGroup = HttpApiGroup.make( "splendor" )
	.add(
		CreateGameApiEndpoint( SplendorConfig ),
		GetStateApiEndpoint( SplendorSnapshot ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "pickTokens", PickTokensInput ),
		MoveApiEndpoint( "reserveCard", ReserveCardInput ),
		MoveApiEndpoint( "purchaseCard", PurchaseCardInput )
	)
	.prefix( "/splendor" )
	.middleware( AuthMiddleware );
