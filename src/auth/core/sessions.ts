import type { SessionData } from "@/auth/core/types";
import { DurableObject, env } from "cloudflare:workers";
import { defineDurableSession } from "rwsdk/auth";

export class UserSession extends DurableObject {
	private storage: DurableObjectStorage;
	private session: SessionData | undefined = undefined;

	constructor( state: DurableObjectState, env: Env ) {
		super( state, env );
		this.storage = state.storage;
	}

	async getSession() {
		if ( !this.session ) {
			this.session = ( await this.storage.get<SessionData>( "session" ) ) ?? { authInfo: null };
		}
		return { value: this.session };
	}

	async saveSession( data: Partial<SessionData> ) {
		this.session = { authInfo: data.authInfo ?? null };
		await this.storage.put( "session", this.session );
		return this.session;
	}

	async revokeSession() {
		await this.storage.delete( "session" );
		this.session = undefined;
	}
}

export const sessionStore = defineDurableSession( {
	sessionDurableObject: env.SESSION
} );