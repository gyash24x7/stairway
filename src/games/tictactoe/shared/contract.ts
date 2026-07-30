import { AuthMiddleware } from "@/auth/shared/middleware";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint
} from "@/shared/swish/api";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import { PlaceInput, TicTacToeConfig, TicTacToeSnapshot } from "./schema";

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
