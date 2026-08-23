import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	PlaceInput,
	TicTacToeConfig,
	TicTacToeCreateInput,
	TicTacToeView
} from "@/games/tictactoe/shared/schema.ts";
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

export const TicTacToeApiGroup = HttpApiGroup.make( "tictactoe" )
	.add(
		CreateGameApiEndpoint( TicTacToeCreateInput ),
		GetViewApiEndpoint( TicTacToeView, TicTacToeConfig ),
		JoinApiEndpoint(),
		StartApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "place", PlaceInput ),
		SetAutoPlayApiEndpoint(),
		RematchApiEndpoint(),
		UndoApiEndpoint(),
		RedoApiEndpoint()
	)
	.prefix( "/tictactoe" )
	.middleware( AuthMiddleware );
