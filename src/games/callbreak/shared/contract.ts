import { AuthMiddleware } from "@/auth/shared/middleware";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint
} from "@/shared/swish/api";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import { CallbreakConfig, CallbreakSnapshot, DeclareWinsInput, PlayCardInput } from "./schema";

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
