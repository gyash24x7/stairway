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
import { ExpressHandler, ExpressMiddleware, logger } from "@s2h/utils";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Connection } from "rethinkdb-ts";
import { renderTrpcPanel } from "trpc-panel";
import { askCard, callSet, chanceTransfer, createGame, createTeams, getGame, joinGame, startGame } from "./resolvers";
import type { LiteratureTrpcContext } from "./utils";
import { procedure, procedureWithGame, procedureWithGameInProgress, router } from "./utils";

export const literatureRouter = router( {
	createGame: procedure.input( createGameInput ).mutation( createGame() ),
	joinGame: procedure.input( joinGameInput ).mutation( joinGame() ),
	createTeams: procedureWithGame.input( createTeamsInput ).mutation( createTeams() ),
	getGame: procedureWithGame.input( getGameInput ).query( getGame() ),
	startGame: procedureWithGame.input( startGameInput ).mutation( startGame() ),
	askCard: procedureWithGameInProgress.input( askCardInput ).mutation( askCard() ),
	chanceTransfer: procedureWithGameInProgress.input( chanceTransferInput ).mutation( chanceTransfer() ),
	callSet: procedureWithGameInProgress.input( callSetInput ).mutation( callSet() )
} );

export type LiteratureRouter = typeof literatureRouter;

export function literatureExpressHandler( connection: Connection ): ExpressMiddleware {
	return createExpressMiddleware( {
		router: literatureRouter,
		createContext( { res } ): LiteratureTrpcContext {
			return { connection, loggedInUser: res.locals[ "user" ] };
		}
	} );
}

export function literatureTrpcPanelHandler( url: string ): ExpressHandler {
	return ( _req, res ) => {
		logger.debug( ">> literatureTrpcPanelHandler()" );
		res.send( renderTrpcPanel( literatureRouter, { url, transformer: "superjson" } ) );
	};
}

export * from "./utils";