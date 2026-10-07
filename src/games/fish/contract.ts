import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AuthMiddleware } from "@/auth/contract";
import {
	AskCardInput,
	ClaimBookInput,
	FishConfig,
	FishCreateInput,
	FishMoveSchemas,
	FishView,
	TransferTurnInput
} from "@/games/fish/schema";
import {
	AddBotsApiEndpoint,
	AutoPlayApiEndpoint,
	CreateGameApiEndpoint,
	GetViewApiEndpoint,
	HintApiEndpoint,
	JoinGameApiEndpoint,
	JoinTeamApiEndpoint,
	LeaveTeamApiEndpoint,
	MoveApiEndpoint,
	NameTeamApiEndpoint,
	RedoApiEndpoint,
	RematchApiEndpoint,
	SpectateApiEndpoint,
	StartGameApiEndpoint,
	SubscribeApiEndpoint,
	UndoApiEndpoint
} from "@/swish/endpoints";


// --- Fish Endpoints ------------------------------------------------------

const FishApiGroup = HttpApiGroup.make( "fish" )
	.add(
		CreateGameApiEndpoint( FishCreateInput ),
		GetViewApiEndpoint( FishView, FishConfig ),
		SubscribeApiEndpoint( FishView, FishConfig ),
		JoinGameApiEndpoint(),
		SpectateApiEndpoint(),
		StartGameApiEndpoint(),
		AddBotsApiEndpoint(),
		JoinTeamApiEndpoint(),
		LeaveTeamApiEndpoint(),
		NameTeamApiEndpoint(),
		MoveApiEndpoint( "askCard", AskCardInput ),
		MoveApiEndpoint( "claimBook", ClaimBookInput ),
		MoveApiEndpoint( "transferTurn", TransferTurnInput ),
		HintApiEndpoint( FishMoveSchemas ),
		AutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.middleware( AuthMiddleware )
	.prefix( "/fish" );

export const FishApi = HttpApi.make( "api" ).add( FishApiGroup ).prefix( "/api" );
