import { CallbreakApiGroup } from "@/games/callbreak/shared/contract";
import { FishApiGroup } from "@/games/fish/shared/contract";
import { KingdominoApiGroup } from "@/games/kingdomino/shared/contract";
import { SplendorApiGroup } from "@/games/splendor/shared/contract";
import { TicTacToeApiGroup } from "@/games/tictactoe/shared/contract";
import { WordleApiGroup } from "@/games/wordle/shared/contract";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import { AuthApiGroup, HealthApiGroup } from "./groups.ts";

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
