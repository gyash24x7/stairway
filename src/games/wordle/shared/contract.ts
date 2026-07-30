import { AuthMiddleware } from "@/contract/middleware";
import {
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	MoveApiEndpoint
} from "@/engine/api";
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
