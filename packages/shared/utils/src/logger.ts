import { Logger } from "tslog";

const logger = new Logger( {
	name: "Stairway",
	hideLogPositionForProduction: true
} );

export function createLogger( name: string ) {
	return logger.getSubLogger( { name } );
}