import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AuthMiddleware } from "@/auth/contract";
import {
	ClaimNobleInput,
	PassTurnInput,
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	SplendorCreateInput,
	SplendorMoveSchemas,
	SplendorView
} from "@/games/splendor/schema";
import {
	AddBotsApiEndpoint,
	AutoPlayApiEndpoint,
	CreateGameApiEndpoint,
	GetViewApiEndpoint,
	HintApiEndpoint,
	JoinGameApiEndpoint,
	MoveApiEndpoint,
	RedoApiEndpoint,
	RematchApiEndpoint,
	RespondApiEndpoint,
	SpectateApiEndpoint,
	StartGameApiEndpoint,
	SubscribeApiEndpoint,
	UndoApiEndpoint
} from "@/swish/endpoints";

// --- Splendor Endpoints --------------------------------------------------------

const SplendorApiGroup = HttpApiGroup.make( "splendor" )
	.add(
		CreateGameApiEndpoint( SplendorCreateInput ),
		GetViewApiEndpoint( SplendorView, SplendorConfig ),
		SubscribeApiEndpoint( SplendorView, SplendorConfig ),
		JoinGameApiEndpoint(),
		SpectateApiEndpoint(),
		StartGameApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "pickTokens", PickTokensInput ),
		MoveApiEndpoint( "reserveCard", ReserveCardInput ),
		MoveApiEndpoint( "purchaseCard", PurchaseCardInput ),
		MoveApiEndpoint( "passTurn", PassTurnInput ),
		RespondApiEndpoint( "claimNoble", ClaimNobleInput ),
		HintApiEndpoint( SplendorMoveSchemas ),
		AutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.middleware( AuthMiddleware )
	.prefix( "/splendor" );

export const SplendorApi = HttpApi.make( "api" ).add( SplendorApiGroup ).prefix( "/api" );
