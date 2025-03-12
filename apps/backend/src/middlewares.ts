import { createLogger } from "@stairway/utils";
import { defineEventHandler, getRequestURL, handleCors } from "h3";

const logger = createLogger( "Middlewares" );

export const loggingMiddleware = defineEventHandler( event => {
	const { pathname } = getRequestURL( event );
	logger.debug( `[ ${ event.method } ] ${ pathname }` );
} );

export const corsMiddleware = defineEventHandler( async ( event ) => {
	const didHandleCors = handleCors( event, {
		origin: [ Bun.env.FRONTEND_URL ],
		preflight: {
			statusCode: 204
		},
		credentials: true,
		methods: "*"
	} );

	if ( didHandleCors ) {
		return;
	}
} );