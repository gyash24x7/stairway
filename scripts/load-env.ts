let envFileContent = "";

Object.keys( Bun.env ).map( key => {
	envFileContent += `${ key }=${ Bun.env[ key ] }\n`;
} );

console.log( `Loading env vars...` );
Bun.write( "apps/wss/.env", envFileContent ).then( () => {
	console.log( "Env file created!" );
} );

console.log( `Loading env vars...` );
Bun.write( "apps/web/.env", envFileContent ).then( () => {
	console.log( "Env file created!" );
} );