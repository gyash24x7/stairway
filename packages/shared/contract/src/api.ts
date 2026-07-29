import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import {
	AuthApiGroup,
	CallbreakApiGroup,
	FishApiGroup,
	HealthApiGroup,
	KingdominoApiGroup,
	SplendorApiGroup,
	TicTacToeApiGroup,
	WordleApiGroup
} from "./groups.ts";

export const StairwayAPI = HttpApi.make( "api" )
	.add(
		HealthApiGroup,
		AuthApiGroup,
		CallbreakApiGroup,
		FishApiGroup,
		KingdominoApiGroup,
		SplendorApiGroup,
		TicTacToeApiGroup,
		WordleApiGroup
	)
	.prefix( "/api" );