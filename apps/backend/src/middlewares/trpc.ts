import { CreateExpressContextOptions, createExpressMiddleware } from "@trpc/server/adapters/express";
import type { ExpressMiddleware, TrpcContext } from "@s2h/utils";
import { Publisher } from "@s2h/utils";
import prisma from "../utils/prisma";
import { literatureRouter as router } from "@s2h/literature/router";
import type { Namespace } from "socket.io";
import type { EnhancedLitGame } from "@s2h/literature/utils";

export function createContextFactory( namespace: Namespace ) {
	return function ( { req, res }: CreateExpressContextOptions ): TrpcContext {
		return { req, res, prisma, litGamePublisher: new Publisher<EnhancedLitGame>( namespace ) };
	};
}

const handleTrpc = function ( namespace: Namespace ): ExpressMiddleware {
	return createExpressMiddleware( { router, createContext: createContextFactory( namespace ) } );
};

export default handleTrpc;