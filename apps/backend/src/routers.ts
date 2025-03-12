import { router as callbreakRouter } from "@callbreak/api";
import { router as literatureRouter } from "@literature/api";
import { router as wordleRouter } from "@wordle/api";
import { createRouter, useBase } from "h3";
import { authHandler, healthHandler, trpcHandler } from "./handlers";

export const apiRouter = createRouter()
	.use( "/health", healthHandler() )
	.use( "/auth/**", useBase( "/auth", authHandler() ) )
	.use( "/callbreak/**", useBase( "/callbreak", trpcHandler( "/api/callbreak", callbreakRouter ) ) )
	.use( "/literature/**", useBase( "/literature", trpcHandler( "/api/literature", literatureRouter ) ) )
	.use( "/wordle/**", useBase( "/wordle", trpcHandler( "/api/wordle", wordleRouter ) ) );

export const appRouter = createRouter()
	.use( "/api/**", useBase( "/api", apiRouter.handler ) );