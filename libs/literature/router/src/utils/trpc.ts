import * as trpc from "@trpc/server";
import superjson from "superjson";
import { requireGame, requireGameInProgress, requirePlayer } from "../middlewares";
import { LitTrpcContext } from "./types";

export const t = trpc.initTRPC.context<LitTrpcContext>().create( { transformer: superjson } );
export const router = t.router;
export const procedure = t.procedure;
export const procedureWithGame = procedure.use( requireGame() ).use( requirePlayer() );
export const procedureWithGameInProgress = procedureWithGame.use( requireGameInProgress() );