import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint
} from "@/shared/swish/api.ts";
import { PlaceInput, TicTacToeConfig, TicTacToeSnapshot } from "@/games/tictactoe/shared/schema.ts";

export const TicTacToeApiGroup = HttpApiGroup.make( "tictactoe" )
	.add(
		CreateGameApiEndpoint( TicTacToeConfig ),
		GetStateApiEndpoint( TicTacToeSnapshot ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "place", PlaceInput )
	)
	.prefix( "/tictactoe" )
	.middleware( AuthMiddleware );
