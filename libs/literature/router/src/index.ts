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
import type { LitTrpcContext } from "./types";
import requireGame from "./middlewares/require-game";
import requirePlayer from "./middlewares/require-player";
import requireGameInProgress from "./middlewares/require-game-in-progress";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

export const literatureRouter = trpc.router<LitTrpcContext>()
    .mutation( "create-game", { input: createGameInputStruct, resolve: createGameResolver } )
    .mutation( "join-game", { input: joinGameInputStruct, resolve: joinGameResolver } )
    .middleware( requireGame )
    .middleware( requirePlayer )
    .query( "get-game", { input: getGameInputStruct, resolve: getGameResolver } )
    .mutation( "create-teams", { input: createTeamsInputStruct, resolve: createTeamsResolver } )
    .mutation( "start-game", { input: startGameInputStruct, resolve: startGameResolver } )
    .middleware( requireGameInProgress )
    .mutation( "ask-card", { input: askCardInputStruct, resolve: askCardResolver } )
    .mutation( "decline-card", { input: declineCardInputStruct, resolve: declineCardResolver } )
    .mutation( "give-card", { input: giveCardInputStruct, resolve: giveCardResolver } )
    .mutation( "call-set", { input: callSetInputStruct, resolve: callSetResolver } )
    .mutation( "transfer-turn", { input: transferTurnInputStruct, resolve: transferTurnResolver } );

export type LiteratureRouter = typeof literatureRouter;

export function literatureExpressHandler( ctx: LitTrpcContext ) {
    return createExpressMiddleware( {
        router: literatureRouter,
        createContext: ( { res } ): LitTrpcContext => (
            { ...ctx, loggedInUser: res.locals[ "user" ] }
        )
    } );
}