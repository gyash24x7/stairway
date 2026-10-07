import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AuthMiddleware } from "@/auth/contract";
import {
	CallbreakConfig,
	CallbreakCreateInput,
	CallbreakMoveSchemas,
	CallbreakView,
	DeclareWinsInput,
	PlayCardInput
} from "@/games/callbreak/schema";
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


// --- Callbreak Endpoints ------------------------------------------------------

const CallbreakApiGroup = HttpApiGroup.make( "callbreak" )
	.add(
		CreateGameApiEndpoint( CallbreakCreateInput ),
		GetViewApiEndpoint( CallbreakView, CallbreakConfig ),
		SubscribeApiEndpoint( CallbreakView, CallbreakConfig ),
		JoinGameApiEndpoint(),
		SpectateApiEndpoint(),
		StartGameApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "declareWins", DeclareWinsInput ),
		MoveApiEndpoint( "playCard", PlayCardInput ),
		HintApiEndpoint( CallbreakMoveSchemas ),
		AutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.middleware( AuthMiddleware )
	.prefix( "/callbreak" );

export const CallbreakApi = HttpApi.make( "api" ).add( CallbreakApiGroup ).prefix( "/api" );
