import { Logger } from "tslog";

const logger = new Logger( { name: "Stairway" } );

export function createLogger( name: string ) {
	return logger.getSubLogger( { name } );
}