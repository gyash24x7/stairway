import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	GetTableStateApiEndpoint,
	MoveApiEndpoint
} from "@/shared/swish/api.ts";
import { GuessInput, WordleCreateInput, WordleSnapshot } from "@/games/wordle/shared/schema.ts";

export const WordleApiGroup = HttpApiGroup.make( "wordle" )
	.add(
		CreateGameApiEndpoint( WordleCreateInput ),
		GetStateApiEndpoint( WordleSnapshot ),
		GetTableStateApiEndpoint( WordleSnapshot ),
		MoveApiEndpoint( "guess", GuessInput )
	)
	.prefix( "/wordle" )
	.middleware( AuthMiddleware );
