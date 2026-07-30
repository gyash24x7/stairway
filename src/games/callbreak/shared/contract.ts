import { AuthMiddleware } from "@/contract/middleware";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint
} from "@/engine/api";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import {
	CallbreakConfig,
	CallbreakSnapshot,
	DeclareWinsInput,
	PlayCardInput
} from "./schema";

export const CallbreakApiGroup = HttpApiGroup.make( "callbreak" )
	.add(
		CreateGameApiEndpoint( CallbreakConfig ),
		GetStateApiEndpoint( CallbreakSnapshot ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "declareWins", DeclareWinsInput ),
		MoveApiEndpoint( "playCard", PlayCardInput )
	)
	.prefix( "/callbreak" )
	.middleware( AuthMiddleware );
