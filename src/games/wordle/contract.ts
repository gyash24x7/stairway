import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AuthMiddleware } from "@/auth/contract";
import {
	ForfeitInput,
	GuessInput,
	WordleConfig,
	WordleCreateInput,
	WordleMoveSchemas,
	WordleView
} from "@/games/wordle/schema";
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


// --- Wordle Endpoints ------------------------------------------------------

const WordleApiGroup = HttpApiGroup.make( "wordle" )
	.add(
		CreateGameApiEndpoint( WordleCreateInput ),
		GetViewApiEndpoint( WordleView, WordleConfig ),
		SubscribeApiEndpoint( WordleView, WordleConfig ),
		JoinGameApiEndpoint(),
		SpectateApiEndpoint(),
		StartGameApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "guess", GuessInput ),
		MoveApiEndpoint( "forfeit", ForfeitInput ),
		HintApiEndpoint( WordleMoveSchemas ),
		AutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.middleware( AuthMiddleware )
	.prefix( "/wordle" );

export const WordleApi = HttpApi.make( "api" ).add( WordleApiGroup ).prefix( "/api" );
