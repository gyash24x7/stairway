import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	AskCardInput,
	ClaimBookInput,
	FishConfig,
	FishCreateInput,
	FishView,
	TransferTurnInput
} from "@/games/fish/shared/schema.ts";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetViewApiEndpoint,
	JoinApiEndpoint,
	JoinTeamApiEndpoint,
	LeaveTeamApiEndpoint,
	MoveApiEndpoint,
	NameTeamApiEndpoint,
	RedoApiEndpoint,
	RematchApiEndpoint,
	SetAutoPlayApiEndpoint,
	StartApiEndpoint,
	UndoApiEndpoint
} from "@/swish/shared/contract.ts";

export const FishApiGroup = HttpApiGroup.make( "fish" )
	.add(
		CreateGameApiEndpoint( FishCreateInput ),
		GetViewApiEndpoint( FishView, FishConfig ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		JoinTeamApiEndpoint(),
		NameTeamApiEndpoint(),
		LeaveTeamApiEndpoint(),
		StartApiEndpoint(),
		MoveApiEndpoint( "askCard", AskCardInput ),
		MoveApiEndpoint( "claimBook", ClaimBookInput ),
		MoveApiEndpoint( "transferTurn", TransferTurnInput ),
		SetAutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.prefix( "/fish" )
	.middleware( AuthMiddleware );
