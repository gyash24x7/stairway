/**
 * `pushManager.subscribe` wants the VAPID public key as raw bytes, while it
 * travels everywhere else as base64url. This is the only place that conversion
 * happens.
 *
 * @param base64 - The base64url-encoded application server key.
 * @returns The same key as bytes.
 */
export function urlBase64ToUint8Array( base64: string ) {
	const padding = "=".repeat( ( 4 - base64.length % 4 ) % 4 );
	const normalised = ( base64 + padding ).replace( /-/g, "+" ).replace( /_/g, "/" );

	const raw = atob( normalised );
	const output = new Uint8Array( raw.length );
	for ( let i = 0; i < raw.length; i++ ) {
		output[ i ] = raw.charCodeAt( i );
	}

	return output;
}
