import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	ForfeitInput,
	GuessInput,
	WordleConfig,
	WordleCreateInput,
	WordleView
} from "@/games/wordle/shared/schema.ts";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetViewApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint,
	SetAutoPlayApiEndpoint
} from "@/swish/shared/contract.ts";

export const WordleApiGroup = HttpApiGroup.make( "wordle" )
	.add(
		CreateGameApiEndpoint( WordleCreateInput ),
		JoinApiEndpoint(),
		GetViewApiEndpoint( WordleView, WordleConfig ),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "guess", GuessInput ),
		MoveApiEndpoint( "forfeit", ForfeitInput ),
		SetAutoPlayApiEndpoint()
	)
	.prefix( "/wordle" )
	.middleware( AuthMiddleware );
