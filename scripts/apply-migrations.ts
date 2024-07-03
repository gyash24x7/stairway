import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env[ "DATABASE_URL" ] ?? "";
const migrationsFolder = "migrations";

const databaseClient = postgres( connectionString, { max: 1 } );
const db = drizzle( databaseClient );

migrate( db, { migrationsFolder } )
	.then( () => {
		console.log( "Migrations Applied!" );
		process.exit( 0 );
	} )
	.catch( err => {
		console.error( "Some Error Applying Migrations!" );
		console.log( err );
		process.exit( 1 );
	} );