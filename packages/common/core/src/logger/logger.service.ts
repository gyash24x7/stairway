import type { Logger, LoggerService as NestLoggerService } from "@nestjs/common";
import { format } from "node:util";

export class LoggerService implements NestLoggerService {
	constructor( private readonly logger: Logger ) {}

	debug( message: string, ...params: any[] ) {
		this.logger.debug( format( message, ...params ) );
	}

	error( message: string, ...params: any[] ) {
		this.logger.error( format( message, ...params ) );
	}

	log( message: string, ...params: any[] ) {
		this.logger.log( format( message, ...params ) );
	}

	verbose( message: string, ...params: any[] ) {
		this.logger.verbose( format( message, ...params ) );
	}

	warn( message: string, ...params: any[] ) {
		this.logger.warn( format( message, ...params ) );
	}

	info( message: string, ...params: any[] ) {
		this.logger.log( format( message, ...params ) );
	}

	trace( message: string, ...params: any[] ) {
		this.logger.verbose( format( message, ...params ) );
	}
}