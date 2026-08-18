import * as HttpApi from "effect/unstable/httpapi/HttpApi";

import { AuthApiGroup } from "@/auth/shared/contract.ts";
import { ChatApiGroup } from "@/chat/shared/contract.ts";
import { CallbreakApiGroup } from "@/games/callbreak/shared/contract.ts";
import { FishApiGroup } from "@/games/fish/shared/contract.ts";
import { KingdominoApiGroup } from "@/games/kingdomino/shared/contract.ts";
import { SplendorApiGroup } from "@/games/splendor/shared/contract.ts";
import { TicTacToeApiGroup } from "@/games/tictactoe/shared/contract.ts";
import { WordleApiGroup } from "@/games/wordle/shared/contract.ts";

export const StairwayAPI = HttpApi.make( "api" )
	.add( AuthApiGroup )
	.add( ChatApiGroup )
	.add( CallbreakApiGroup )
	.add( FishApiGroup )
	.add( KingdominoApiGroup )
	.add( SplendorApiGroup )
	.add( TicTacToeApiGroup )
	.add( WordleApiGroup )
	.prefix( "/api" );
