import {
	askCardInput,
	callSetInput,
	createGameInput,
	createTeamsInput,
	getGameInput,
	joinGameInput,
	startGameInput,
	transferTurnInput
} from "@s2h/literature/dtos";
import { ExpressHandler } from "@s2h/utils";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { renderTrpcPanel } from "trpc-panel";
import { createGame } from "./resolvers/create-game";
import { createTeams } from "./resolvers/create-teams";
import { joinGame } from "./resolvers/join-game";
import type { LitTrpcContext } from "./types";
import { procedure, procedureWithGame, procedureWithGameInProgress, router } from "./utils";
import { getGame } from "./resolvers/get-game";
import { startGame } from "./resolvers/start-game";
import { askCard } from "./resolvers/ask-card";
import { callSet } from "./resolvers/call-set";

export const literatureRouter = router( {
	createGame: procedure.input( createGameInput ).mutation( createGame ),
	joinGame: procedure.input( joinGameInput ).mutation( joinGame ),
	createTeams: procedureWithGame.input( createTeamsInput ).mutation( createTeams ),
	getGame: procedureWithGame.input( getGameInput ).query( getGame ),
	startGame: procedureWithGame.input( startGameInput ).mutation( startGame ),
	askCard: procedureWithGameInProgress.input( askCardInput ).mutation( askCard ),
	transferTurn: procedureWithGameInProgress.input( transferTurnInput ).mutation( transferTurn ),
	callSet: procedureWithGameInProgress.input( callSetInput ).mutation( callSet )
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