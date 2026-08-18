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
	MoveApiEndpoint,
	NameTeamApiEndpoint,
	RedoApiEndpoint,
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
		StartApiEndpoint(),
		MoveApiEndpoint( "askCard", AskCardInput ),
		MoveApiEndpoint( "claimBook", ClaimBookInput ),
		MoveApiEndpoint( "transferTurn", TransferTurnInput ),
		SetAutoPlayApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.prefix( "/fish" )
	.middleware( AuthMiddleware );
