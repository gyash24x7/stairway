import { Logger, type Type } from "@nestjs/common";

export class LoggerFactory {
	static getLogger( scope: Type ) {
		return new Logger( scope.name );
	}
}
