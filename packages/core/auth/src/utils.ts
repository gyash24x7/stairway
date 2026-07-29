/** Name of the cookie carrying the signed session token. */
export const SESSION_COOKIE = "session";

/** Session lifetime in seconds (30 days). */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

let cachedKey: CryptoKey | null = null;

/** Imports the HMAC signing key from the AUTH_SECRET_KEY secret (memoized per isolate). */
async function getSigningKey(): Promise<CryptoKey> {
	if ( cachedKey ) {
		return cachedKey;
	}

	cachedKey = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode( process.env[ "AUTH_SECRET_KEY" ] ),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		[ "sign", "verify" ]
	);

	return cachedKey;
}

/** Encodes bytes as base64url without padding. */
function toBase64Url( bytes: ArrayBuffer ): string {
	const binary = String.fromCharCode( ...new Uint8Array( bytes ) );
	return btoa( binary ).replace( /\+/g, "-" ).replace( /\//g, "_" ).replace( /=+$/, "" );
}

/** Computes the base64url HMAC-SHA256 signature of a token. */
async function sign( token: string ): Promise<string> {
	const key = await getSigningKey();
	const signature = await crypto.subtle.sign( "HMAC", key, new TextEncoder().encode( token ) );
	return toBase64Url( signature );
}

/** Length-invariant comparison of two signatures. */
function safeEqual( a: string, b: string ): boolean {
	if ( a.length !== b.length ) {
		return false;
	}

	let mismatch = 0;
	for ( let i = 0; i < a.length; i++ ) {
		mismatch |= a.charCodeAt( i ) ^ b.charCodeAt( i );
	}
	return mismatch === 0;
}

/** Builds the signed cookie value `${token}.${signature}` for a session id. */
export async function serializeToken( token: string ): Promise<string> {
	const signature = await sign( token );
	return `${ token }.${ signature }`;
}

/** Verifies a signed cookie value and returns the session token if the signature is valid. */
export async function parseToken( value: string ): Promise<string | null> {
	const idx = value.lastIndexOf( "." );
	if ( idx <= 0 ) {
		return null;
	}

	const token = value.slice( 0, idx );
	const signature = value.slice( idx + 1 );
	const expected = await sign( token );
	return safeEqual( signature, expected ) ? token : null;
}