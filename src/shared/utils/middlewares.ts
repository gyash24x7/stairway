import { useAppSession } from "@/auth/core/sessions";
import { createMiddleware } from "@tanstack/react-start";

export const requireAuthInfo = createMiddleware().server(
	async ( { next } ) => {
		const session = await useAppSession();
		if ( !session.data || !session.data.authInfo ) {
			throw new Response( null, { status: 401 } );
		}

		return next( { context: { authInfo: session.data.authInfo } } );
	}
);