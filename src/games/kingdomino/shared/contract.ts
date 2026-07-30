import { AuthMiddleware } from "@/auth/shared/middleware";
import {
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint
} from "@/shared/swish/api";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import {
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoSnapshot,
	PlaceDominoInput,
	SelectDominoInput
} from "./schema";

export const KingdominoApiGroup = HttpApiGroup.make( "kingdomino" )
	.add(
		CreateGameApiEndpoint( KingdominoConfig ),
		GetStateApiEndpoint( KingdominoSnapshot ),
		JoinApiEndpoint(),
		MoveApiEndpoint( "selectDomino", SelectDominoInput ),
		MoveApiEndpoint( "placeDomino", PlaceDominoInput ),
		MoveApiEndpoint( "discardDomino", DiscardDominoInput )
	)
	.prefix( "/kingdomino" )
	.middleware( AuthMiddleware );
