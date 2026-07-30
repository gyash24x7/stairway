import { AuthMiddleware } from "@/contract/middleware";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint
} from "@/engine/api";
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
