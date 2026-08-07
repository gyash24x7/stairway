import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	StartApiEndpoint,
	MoveApiEndpoint
} from "@/shared/swish/api.ts";
import {
	CallbreakCreateInput,
	CallbreakSnapshot,
	DeclareWinsInput,
	PlayCardInput
} from "@/games/callbreak/shared/schema.ts";

export const CallbreakApiGroup = HttpApiGroup.make( "callbreak" )
	.add(
		CreateGameApiEndpoint( CallbreakCreateInput ),
		GetStateApiEndpoint( CallbreakSnapshot ),
		JoinApiEndpoint(),
		StartApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "declareWins", DeclareWinsInput ),
		MoveApiEndpoint( "playCard", PlayCardInput )
	)
	.prefix( "/callbreak" )
	.middleware( AuthMiddleware );
