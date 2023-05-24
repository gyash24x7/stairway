import {
	askCardInput,
	callSetInput,
	chanceTransferInput,
	createGameInput,
	createTeamsInput,
	getGameInput,
	joinGameInput,
	startGameInput
} from "@s2h/literature/dtos";
import { ExpressHandler, ExpressMiddleware } from "@s2h/utils";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { renderTrpcPanel } from "trpc-panel";
import { askCard, callSet, chanceTransfer, createGame, createTeams, getGame, joinGame, startGame } from "./resolvers";
import type { LiteratureR, LitTrpcContext } from "./types";
import { procedure, procedureWithGame, procedureWithGameInProgress, router } from "./utils";
import { subscribeGame } from "./resolvers/subscribe-game";
import { Connection } from "rethinkdb-ts";

export const literatureRouter = router( {
	createGame: procedure.input( createGameInput ).mutation( createGame ),
	joinGame: procedure.input( joinGameInput ).mutation( joinGame ),
	createTeams: procedureWithGame.input( createTeamsInput ).mutation( createTeams ),
	getGame: procedureWithGame.input( getGameInput ).query( getGame ),
	startGame: procedureWithGame.input( startGameInput ).mutation( startGame ),
	subscribeToGame: procedureWithGame.input( getGameInput ).subscription( subscribeGame() ),
	askCard: procedureWithGameInProgress.input( askCardInput ).mutation( askCard ),
	chanceTransfer: procedureWithGameInProgress.input( chanceTransferInput ).mutation( chanceTransfer ),
	callSet: procedureWithGameInProgress.input( callSetInput ).mutation( callSet )
} );

export type LiteratureRouter = typeof literatureRouter;

export function literatureExpressHandler( db: LiteratureR, connection: Connection ): ExpressMiddleware {
	return createExpressMiddleware( {
		router: literatureRouter,
		createContext( { res } ): LitTrpcContext {
			return { connection, loggedInUser: res.locals[ "user" ], db };
		}
	} );
}

export function literatureTrpcPanelHandler( url: string ): ExpressHandler {
	return ( _req, res ) => {
		res.send( renderTrpcPanel( literatureRouter, { url, transformer: "superjson" } ) );
	};
}

export * from "./types";