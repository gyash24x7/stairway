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
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoSnapshot,
	PlaceDominoInput,
	SelectDominoInput
} from "@/games/kingdomino/shared/schema.ts";

export const KingdominoApiGroup = HttpApiGroup.make( "kingdomino" )
	.add(
		CreateGameApiEndpoint( KingdominoConfig ),
		GetStateApiEndpoint( KingdominoSnapshot ),
		GetTableStateApiEndpoint( KingdominoSnapshot ),
		JoinApiEndpoint(),
		StartApiEndpoint(),
		MoveApiEndpoint( "selectDomino", SelectDominoInput ),
		MoveApiEndpoint( "placeDomino", PlaceDominoInput ),
		MoveApiEndpoint( "discardDomino", DiscardDominoInput )
	)
	.prefix( "/kingdomino" )
	.middleware( AuthMiddleware );
