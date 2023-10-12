import { expect, test } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { Ogma } from "@ogma/logger";
import { LoggerService } from "../../src/logger/logger.service";

test( "LoggerService should call Ogma Logger methods", async () => {
	const mockOgma = mockDeep<Ogma>();
	const loggerService = new LoggerService( mockOgma );

	loggerService.debug( "debug" );
	expect( mockOgma.debug ).toHaveBeenCalled();

	loggerService.error( "error" );
	expect( mockOgma.error ).toHaveBeenCalled();

	loggerService.info( "info" );
	expect( mockOgma.info ).toHaveBeenCalled();

	loggerService.warn( "warn" );
	expect( mockOgma.warn ).toHaveBeenCalled();

	loggerService.verbose( "verbose" );
	expect( mockOgma.verbose ).toHaveBeenCalled();

	loggerService.trace( "trace" );
	expect( mockOgma.verbose ).toHaveBeenCalled();

	loggerService.log( "log" );
	expect( mockOgma.info ).toHaveBeenCalled();
} );