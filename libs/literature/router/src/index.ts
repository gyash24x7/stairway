import * as trpc from "@trpc/server";
import createGameResolver from "./resolvers/create-game";
import joinGameResolver from "./resolvers/join-game";
import createTeamsResolver from "./resolvers/create-teams";
import startGameResolver from "./resolvers/start-game";
import askCardResolver from "./resolvers/ask-card";
import giveCardResolver from "./resolvers/give-card";
import declineCardResolver from "./resolvers/decline-card";
import getGameResolver from "./resolvers/get-game";
import callSetResolver from "./resolvers/call-set";
import transferTurnResolver from "./resolvers/transfer-turn";
import {
	askCardInputStruct,
	callSetInputStruct,
	createGameInputStruct,
	createTeamsInputStruct,
	declineCardInputStruct,
	getGameInputStruct,
	giveCardInputStruct,
	joinGameInputStruct,
	startGameInputStruct,
	transferTurnInputStruct
} from "@s2h/literature/dtos";
import requireGame from "./middlewares/require-game";
import requirePlayer from "./middlewares/require-player";
import type { TrpcContext } from "@s2h/utils";


export const literatureRouter = trpc.router<TrpcContext>()
	.mutation( "create-game", { input: createGameInputStruct, resolve: createGameResolver } )
	.mutation( "join-game", { input: joinGameInputStruct, resolve: joinGameResolver } )
	.middleware( requireGame )
	.middleware( requirePlayer )
	.query( "get-game", { input: getGameInputStruct, resolve: getGameResolver } )
	.mutation( "transfer-turn", { input: transferTurnInputStruct, resolve: transferTurnResolver } )
	.mutation( "call-set", { input: callSetInputStruct, resolve: callSetResolver } )
	.mutation( "decline-card", { input: declineCardInputStruct, resolve: declineCardResolver } )
	.mutation( "give-card", { input: giveCardInputStruct, resolve: giveCardResolver } )
	.mutation( "ask-card", { input: askCardInputStruct, resolve: askCardResolver } )
	.mutation( "start-game", { input: startGameInputStruct, resolve: startGameResolver } )
	.mutation( "create-teams", { input: createTeamsInputStruct, resolve: createTeamsResolver } );

export type LiteratureRouter = typeof literatureRouter;