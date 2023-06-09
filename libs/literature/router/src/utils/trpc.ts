import * as trpc from "@trpc/server";
import superjson from "superjson";
import { requireGame, requireGameInProgress, requirePlayer, requireTurn } from "../middlewares";
import { requireHands } from "../middlewares/require-hands";
import { LiteratureTrpcContext } from "./types";

export const t = trpc.initTRPC.context<LiteratureTrpcContext>().create( { transformer: superjson } );
export const router = t.router;
export const procedure = t.procedure;
export const procedureWithGame = procedure.use( requireGame() ).use( requirePlayer() );
export const procedureWithGameInProgress = procedureWithGame
	.use( requireGameInProgress() )
	.use( requireHands() )
	.use( requireTurn() );