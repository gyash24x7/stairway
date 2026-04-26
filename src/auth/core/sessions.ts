import type { SessionData } from "@/auth/core/types";
import { DurableObject, env } from "cloudflare:workers";
import { defineDurableSession } from "rwsdk/auth";

/**
 * Durable Object that manages user session storage.
 * Persists session data (auth info) using Durable Object storage.
 */
export class UserSession extends DurableObject {
	private storage: DurableObjectStorage;
	private session: SessionData | undefined = undefined;

	constructor( state: DurableObjectState, env: Env ) {
		super( state, env );
		this.storage = state.storage;
	}

	/** Retrieve the current session data, loading from storage on first access. */
	async getSession() {
		if ( !this.session ) {
			const session = await this.storage.get<SessionData>( "session" );
			this.session = session ?? { authInfo: null };
		}
		return { value: this.session };
	}

	/** Save session data to Durable Object storage. */
	async saveSession( data: Partial<SessionData> ) {
		this.session = { authInfo: data.authInfo ?? null };
		await this.storage.put( "session", this.session );
		return this.session;
	}

	/** Delete the session from storage, effectively logging the user out. */
	async revokeSession() {
		await this.storage.delete( "session" );
		this.session = undefined;
	}
}

/** The session store configured to use the UserSession Durable Object via rwsdk. */
export const sessionStore = defineDurableSession( {
	sessionDurableObject: env.SESSION
} );