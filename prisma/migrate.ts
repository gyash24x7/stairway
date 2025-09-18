import { $ } from "bun";
import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const getNextMigrationNumber = async (): Promise<string> => {
	const migrationsPath = resolve( process.cwd(), "./migrations" );
	await $`mkdir -p ${ migrationsPath }`;

	const files = await readdir( migrationsPath );
	const numbers = files
		.map( ( file ) => parseInt( file.split( "_" )[ 0 ] ) )
		.filter( ( num ) => !isNaN( num ) );

	const lastNumber = Math.max( 0, ...numbers );
	return String( lastNumber + 1 ).padStart( 4, "0" );
};

export const migrate = async ( name: string ) => {
	if ( !name ) {
		console.log( "Usage: bun run migrate:new <migration-name>" );
		console.log( "Example: npm run migrate:new add a user" );
		process.exit( 1 );
	}

	const nextNum = await getNextMigrationNumber();
	const prismaFile = "./prisma/schema.prisma";
	const filepath = `./migrations/${ nextNum }_${ name.toLowerCase().split( " " ).join( "_" ) }.sql`;
	const raw = await $`bunx prisma migrate diff --from-local-d1 --to-schema-datamodel ${ prismaFile } --script`.text();

	const cleaned = raw.split( "\n" )
		.filter( line => !line.includes( "_cf_METADATA" ) && !line.includes( "_cf_metadata" ) )
		.join( "\n" );

	if ( !cleaned ) {
		console.error( "No changes to apply" );
		process.exitCode = 1;
		return;
	}

	await writeFile( filepath, cleaned );
	console.log( "Generated migration:", filepath );
};

if ( import.meta.url === new URL( process.argv[ 1 ], import.meta.url ).href ) {
	const args = process.argv.slice( 2 );
	const nonFlags = args.filter( ( arg ) => !arg.startsWith( "--" ) );
	const name = nonFlags.join( "_" ).toLocaleLowerCase();
	migrate( name ).then( () => {
		process.exit( 0 );
	} );
}