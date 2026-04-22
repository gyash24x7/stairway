import { RouteMiddleware } from "rwsdk/router";

/**
 * Create a middleware that sets security-related HTTP headers.
 * Configures HSTS, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
 *
 * @returns A RouteMiddleware function that sets the headers on each response.
 */
export const setCommonHeaders = (): RouteMiddleware => ( { response } ) => {
	if ( !import.meta.env.VITE_IS_DEV_SERVER ) {
		// Forces browsers to always use HTTPS for a specified time period (2 years)
		response.headers.set(
			"Strict-Transport-Security",
			"max-age=63072000; includeSubDomains; preload"
		);
	}

	// Forces browser to use the declared content-type instead of trying to guess/sniff it
	response.headers.set( "X-Content-Type-Options", "nosniff" );

	// Stops browsers from sending the referring webpage URL in HTTP headers
	response.headers.set( "Referrer-Policy", "no-referrer" );

	// Explicitly disables access to specific browser features/APIs
	response.headers.set(
		"Permissions-Policy",
		"geolocation=(), microphone=(), camera=()"
	);
};
