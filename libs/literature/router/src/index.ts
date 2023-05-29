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
import { ExpressHandler, ExpressMiddleware, initializeSocketNamespace, logger } from "@s2h/utils";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Connection } from "rethinkdb-ts";
import { renderTrpcPanel } from "trpc-panel";
import { askCard, callSet, chanceTransfer, createGame, createTeams, getGame, joinGame, startGame } from "./resolvers";
import type { Db, LiteratureTrpcContext } from "./utils";
import { initializeGameSubscription, procedure, procedureWithGame, procedureWithGameInProgress, router } from "./utils";
import { ILiteratureGame } from "@s2h/literature/utils";
import { Server } from "socket.io";

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

export function literatureExpressHandler( io: Server, connection: Connection, db: Db ): ExpressMiddleware {
	const publisher = initializeSocketNamespace<ILiteratureGame>( io, "literature" );
	initializeGameSubscription( publisher, connection, db );
	return createExpressMiddleware( {
		router: literatureRouter,
		createContext( { res } ): LiteratureTrpcContext {
			return { connection, loggedInUser: res.locals[ "user" ], db, publisher };
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