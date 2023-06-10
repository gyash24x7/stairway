import type { LoggerService as NestLoggerService } from "@nestjs/common";
import type { Ogma } from "@ogma/logger";
import { format } from "node:util";

export class LoggerService implements NestLoggerService {
	constructor( private readonly ogma: Ogma, private readonly scope?: string ) { }

	debug( message: string, ...params: any[] ) {
		this.ogma.debug( format( message, ...params ), { context: this.scope } );
	}

	error( message: string, ...params: any[] ) {
		this.ogma.error( format( message, ...params ), { context: this.scope } );
	}

	log( message: string, ...params: any[] ) {
		this.ogma.info( format( message, ...params ), { context: this.scope } );
	}

	verbose( message: string, ...params: any[] ) {
		this.ogma.verbose( format( message, ...params ), { context: this.scope } );
	}

	warn( message: string, ...params: any[] ) {
		this.ogma.warn( format( message, ...params ), { context: this.scope } );
	}

	info( message: string, ...params: any[] ) {
		this.ogma.info( format( message, ...params ), { context: this.scope } );
	}

	trace( message: string, ...params: any[] ) {
		this.ogma.verbose( format( message, ...params ), { context: this.scope } );
	}
}
