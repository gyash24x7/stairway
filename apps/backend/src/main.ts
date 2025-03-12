import { createLogger } from "@stairway/utils";
import { createApp, toWebHandler } from "h3";
import { corsMiddleware, loggingMiddleware } from "./middlewares";
import { appRouter } from "./routers";
import { handleUpgrade, websocket } from "./ws";

const logger = createLogger( "App" );
const app = createApp();

app.use( loggingMiddleware );
app.use( corsMiddleware );
app.use( appRouter );

const handler = toWebHandler( app );

Bun.serve( {
	port: 8000,
	websocket,
	fetch: ( request, server ) => {
		if ( request.headers.get( "upgrade" ) === "websocket" ) {
			return handleUpgrade( request, server );
		}

		return handler( request );
	}
} );

logger.debug( "Server started on 8000!" );