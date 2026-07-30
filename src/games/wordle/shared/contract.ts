import { AuthMiddleware } from "@/auth/shared/middleware";
import { CreateGameApiEndpoint, GetStateApiEndpoint, MoveApiEndpoint } from "@/shared/swish/api";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import { GuessInput, WordleConfig, WordleSnapshot } from "./schema";

export const WordleApiGroup = HttpApiGroup.make( "wordle" )
	.add(
		CreateGameApiEndpoint( WordleConfig ),
		GetStateApiEndpoint( WordleSnapshot ),
		MoveApiEndpoint( "guess", GuessInput )
	)
	.prefix( "/wordle" )
	.middleware( AuthMiddleware );
