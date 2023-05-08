import * as trpc from "@trpc/server";
import superjson from "superjson";
import requireGameMiddlewareFn from "../middlewares/require-game";
import requireGameInProgressMiddlewareFn from "../middlewares/require-game-in-progress";
import requirePlayerMiddlewareFn from "../middlewares/require-player";
import { LitTrpcContext } from "../types";

export const t = trpc.initTRPC.context<LitTrpcContext>().create( { transformer: superjson } );
export const router = t.router;
export const procedure = t.procedure;
export const procedureWithGame = t.procedure.use( requireGameMiddlewareFn ).use( requirePlayerMiddlewareFn );
export const procedureWithGameInProgress = procedureWithGame.use( requireGameInProgressMiddlewareFn );