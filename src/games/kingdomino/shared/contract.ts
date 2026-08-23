import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoCreateInput,
	KingdominoView,
	PlaceDominoInput,
	SelectDominoInput
} from "@/games/kingdomino/shared/schema.ts";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetViewApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint,
	RedoApiEndpoint,
	RematchApiEndpoint,
	SetAutoPlayApiEndpoint,
	StartApiEndpoint,
	UndoApiEndpoint
} from "@/swish/shared/contract.ts";

export const KingdominoApiGroup = HttpApiGroup.make( "kingdomino" )
	.add(
		CreateGameApiEndpoint( KingdominoCreateInput ),
		GetViewApiEndpoint( KingdominoView, KingdominoConfig ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		StartApiEndpoint(),
		MoveApiEndpoint( "selectDomino", SelectDominoInput ),
		MoveApiEndpoint( "placeDomino", PlaceDominoInput ),
		MoveApiEndpoint( "discardDomino", DiscardDominoInput ),
		SetAutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.prefix( "/kingdomino" )
	.middleware( AuthMiddleware );
