import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AuthMiddleware } from "@/auth/contract";
import {
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoCreateInput,
	KingdominoMoveSchemas,
	KingdominoView,
	PlaceDominoInput,
	SelectDominoInput
} from "@/games/kingdomino/schema";
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
	SpectateApiEndpoint,
	StartGameApiEndpoint,
	SubscribeApiEndpoint,
	UndoApiEndpoint
} from "@/swish/endpoints";


// --- Kingdomino Endpoints ------------------------------------------------------

const KingdominoApiGroup = HttpApiGroup.make( "kingdomino" )
	.add(
		CreateGameApiEndpoint( KingdominoCreateInput ),
		GetViewApiEndpoint( KingdominoView, KingdominoConfig ),
		SubscribeApiEndpoint( KingdominoView, KingdominoConfig ),
		JoinGameApiEndpoint(),
		SpectateApiEndpoint(),
		StartGameApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "selectDomino", SelectDominoInput ),
		MoveApiEndpoint( "placeDomino", PlaceDominoInput ),
		MoveApiEndpoint( "discardDomino", DiscardDominoInput ),
		HintApiEndpoint( KingdominoMoveSchemas ),
		AutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.middleware( AuthMiddleware )
	.prefix( "/kingdomino" );

export const KingdominoApi = HttpApi.make( "api" ).add( KingdominoApiGroup ).prefix( "/api" );
