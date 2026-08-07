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
import { PlaceInput, TicTacToeCreateInput, TicTacToeSnapshot } from "@/games/tictactoe/shared/schema.ts";

export const TicTacToeApiGroup = HttpApiGroup.make( "tictactoe" )
	.add(
		CreateGameApiEndpoint( TicTacToeCreateInput ),
		GetStateApiEndpoint( TicTacToeSnapshot ),
		JoinApiEndpoint(),
		StartApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "place", PlaceInput )
	)
	.prefix( "/tictactoe" )
	.middleware( AuthMiddleware );
