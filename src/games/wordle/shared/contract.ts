import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import { CreateGameApiEndpoint, GetStateApiEndpoint, MoveApiEndpoint } from "@/shared/swish/api.ts";
import { GuessInput, WordleConfig, WordleSnapshot } from "@/games/wordle/shared/schema.ts";

export const WordleApiGroup = HttpApiGroup.make( "wordle" )
	.add(
		CreateGameApiEndpoint( WordleConfig ),
		GetStateApiEndpoint( WordleSnapshot ),
		MoveApiEndpoint( "guess", GuessInput )
	)
	.prefix( "/wordle" )
	.middleware( AuthMiddleware );
