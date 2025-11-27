import { deleteCookie, getCookie, setCookie, sign, unsign } from "@orpc/server/helpers";
import type { AuthInfo, Session } from "@s2h/auth/types";
import { generateSecureRandomString } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";

const expirationTtl = 7 * 24 * 60 * 60; // 7 days
const cookieOptions = {
	maxAge: expirationTtl,
	path: "/",
	httpOnly: true,
	secure: process.env.NODE_ENV === "production"
};

export class SessionService {

	private readonly logger = createLogger( "Session:Service" );

	constructor(
		private readonly kv: KVNamespace,
		private readonly secret: string
	) {}

	async createSession( authInfo: AuthInfo, headers = new Headers() ) {
		this.logger.debug( ">> createSession()" );

		const sessionId = generateSecureRandomString();
		const session = { id: sessionId, authInfo, createdAt: Date.now() };
		await this.kv.put( session.id, JSON.stringify( session ), { expirationTtl } );
		setCookie( headers, "auth_session", await sign( session.id, this.secret ), cookieOptions );

		this.logger.debug( "<< createSession()" );
	}

	async validateSession( headers: Headers ) {
		this.logger.debug( ">> validateSession()" );

		const sessionCookie = getCookie( headers, "auth_session" );
		if ( !sessionCookie ) {
			this.logger.warn( "No Session Cookie!" );
			return undefined;
		}

		const sessionId = await unsign( sessionCookie, this.secret );
		if ( !sessionId ) {
			this.logger.warn( "Invalid Session Id!" );
			return undefined;
		}

		const session = await this.kv.get( sessionId )
			.then( data => !data ? null : JSON.parse( data ) as Session );
		if ( !session ) {
			this.logger.warn( "No Session Found!" );
			return undefined;
		}

		if ( Date.now() - session.createdAt >= 7 * 24 * 60 * 60 * 1000 ) {
			this.logger.warn( "Session Expired!" );
			await this.kv.delete( session.id );
			return undefined;
		}

		this.logger.debug( "<< validateSession()" );
		return session;
	}

	async deleteSession( sessionId: string, headers = new Headers() ) {
		await this.kv.delete( sessionId );
		deleteCookie( headers, "auth_session" );
	}
}
