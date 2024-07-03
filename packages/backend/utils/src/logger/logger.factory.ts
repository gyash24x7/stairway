import { Logger, type Type } from "@nestjs/common";
import { LoggerService } from "./logger.service.ts";

export class LoggerFactory {
	static getLogger( scope: Type ) {
		const logger = new Logger( scope.name );
		return new LoggerService( logger );
	}
}
