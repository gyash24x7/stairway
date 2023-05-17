import {
	askCardInput,
	callSetInput,
	createGameInput,
	createTeamsInput,
	declineCardInput,
	getGameInput,
	giveCardInput,
	joinGameInput,
	startGameInput,
	transferTurnInput
} from "@s2h/literature/dtos";
import { ExpressHandler } from "@s2h/utils";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { renderTrpcPanel } from "trpc-panel";
import askCardResolver from "./resolvers/ask-card";
import callSetResolver from "./resolvers/call-set";
import createGameResolver from "./resolvers/create-game";
import createTeamsResolver from "./resolvers/create-teams";
import declineCardResolver from "./resolvers/decline-card";
import getGameResolver from "./resolvers/get-game";
import giveCardResolver from "./resolvers/give-card";
import joinGameResolver from "./resolvers/join-game";
import startGameResolver from "./resolvers/start-game";
import transferTurnResolver from "./resolvers/transfer-turn";
import type { LitTrpcContext } from "./types";
import { procedure, procedureWithGame, procedureWithGameInProgress, router } from "./utils";

export const literatureRouter = router( {
	createGame: procedure.input( createGameInput ).mutation( createGameResolver ),
	joinGame: procedure.input( joinGameInput ).mutation( joinGameResolver ),
	createTeams: procedureWithGame.input( createTeamsInput ).mutation( createTeamsResolver ),
	getGame: procedureWithGame.input( getGameInput ).query( getGameResolver ),
	startGame: procedureWithGame.input( startGameInput ).mutation( startGameResolver ),
	askCard: procedureWithGameInProgress.input( askCardInput ).mutation( askCardResolver ),
	declineCard: procedureWithGameInProgress.input( declineCardInput ).mutation( declineCardResolver ),
	giveCard: procedureWithGameInProgress.input( giveCardInput ).mutation( giveCardResolver ),
	transferTurn: procedureWithGameInProgress.input( transferTurnInput ).mutation( transferTurnResolver ),
	callSet: procedureWithGameInProgress.input( callSetInput ).mutation( callSetResolver )
} );

export type LiteratureRouter = typeof literatureRouter;

export function literatureExpressHandler( ctx: LitTrpcContext ) {
	return createExpressMiddleware( {
		router: literatureRouter,
		createContext: ( { res } ): LitTrpcContext => (
			{ ...ctx, loggedInUser: res.locals[ "user" ] }
		)
	} );
}

export function literatureTrpcPanelHandler( url: string ): ExpressHandler {
	return ( _req, res ) => {
		res.send( renderTrpcPanel( literatureRouter, { url, transformer: "superjson" } ) );
	};
}