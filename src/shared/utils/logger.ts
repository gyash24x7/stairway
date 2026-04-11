import { Logger } from "tslog";

const logger = new Logger<{}>( {
	name: "Stairway",
	hideLogPositionForProduction: true
} );

/**
 * Creates a logger with the specified name.
 * @param {string} name - The name of the logger.
 * @returns {Logger<{}>} A logger instance with the specified name.
 */
export function createLogger( name: string ): Logger<{}> {
	return logger.getSubLogger( { name } );
}