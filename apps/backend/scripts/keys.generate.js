const jose = require( "jose" );
const { writeFile } = require( "node:fs/promises" );
const { join } = require( "node:path" );

jose.generateKeyPair( "RS256" ).then( async ( { privateKey, publicKey } ) => {
	await writeFile(
		join( __dirname, "..", "src", "assets", "keys", ".private.key" ),
		await jose.exportPKCS8( privateKey )
	);

	await writeFile(
		join( __dirname, "..", "src", "assets", "keys", ".public.key.pem" ),
		await jose.exportSPKI( publicKey )
	);
} );
