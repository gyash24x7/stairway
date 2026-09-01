import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	BlockInput,
	ChallengeInput,
	CoupConfig,
	CoupCreateInput,
	CoupView,
	ExchangeCardsInput,
	SurrenderInfluenceInput,
	TakeActionInput
} from "@/games/coup/shared/schema.ts";
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

export const CoupApiGroup = HttpApiGroup.make( "coup" )
	.add(
		CreateGameApiEndpoint( CoupCreateInput ),
		GetViewApiEndpoint( CoupView, CoupConfig ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		StartApiEndpoint(),
		MoveApiEndpoint( "takeAction", TakeActionInput ),
		MoveApiEndpoint( "challenge", ChallengeInput ),
		MoveApiEndpoint( "block", BlockInput ),
		MoveApiEndpoint( "surrenderInfluence", SurrenderInfluenceInput ),
		MoveApiEndpoint( "exchangeCards", ExchangeCardsInput ),
		SetAutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.prefix( "/coup" )
	.middleware( AuthMiddleware );
