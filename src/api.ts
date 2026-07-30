import { AuthApiGroup } from "@/auth/shared/contract.ts";
import { CallbreakApiGroup } from "@/games/callbreak/shared/contract.ts";
import { FishApiGroup } from "@/games/fish/shared/contract.ts";
import { KingdominoApiGroup } from "@/games/kingdomino/shared/contract.ts";
import { SplendorApiGroup } from "@/games/splendor/shared/contract.ts";
import { TicTacToeApiGroup } from "@/games/tictactoe/shared/contract.ts";
import { WordleApiGroup } from "@/games/wordle/shared/contract.ts";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";

export const StairwayAPI = HttpApi.make( "api" )
	.add(
		AuthApiGroup,
		CallbreakApiGroup,
		FishApiGroup,
		KingdominoApiGroup,
		SplendorApiGroup,
		TicTacToeApiGroup,
		WordleApiGroup
	)
	.prefix( "/api" );
