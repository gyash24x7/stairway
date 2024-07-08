let envFileContent = "";

Object.keys( Bun.env ).map( key => {
	envFileContent += `${ key }=${ Bun.env[ key ] }\n`
} )

const isBackend = process.argv[ 2 ] === "backend"
console.log( `Loading env vars for ${ process.argv[ 2 ] }` )

await Bun.write( isBackend ? "apps/backend/.env" : "apps/stairway/.env", envFileContent );
