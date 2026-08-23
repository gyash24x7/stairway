import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	CallbreakConfig,
	CallbreakCreateInput,
	CallbreakView,
	DeclareWinsInput,
	PlayCardInput
} from "@/games/callbreak/shared/schema.ts";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetViewApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint,
	RedoApiEndpoint,
	RematchApiEndpoint,
	SetAutoPlayApiEndpoint,
	StartApiEndpoint,
	UndoApiEndpoint
} from "@/swish/shared/contract.ts";

export const CallbreakApiGroup = HttpApiGroup.make( "callbreak" )
	.add(
		CreateGameApiEndpoint( CallbreakCreateInput ),
		GetViewApiEndpoint( CallbreakView, CallbreakConfig ),
		JoinApiEndpoint(),
		StartApiEndpoint(),
		AddBotsApiEndpoint(),
		SetAutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint(),
		MoveApiEndpoint( "declareWins", DeclareWinsInput ),
		MoveApiEndpoint( "playCard", PlayCardInput )
	)
	.prefix( "/callbreak" )
	.middleware( AuthMiddleware );
