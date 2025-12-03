import { describe, expect, it } from "vitest";
import { createLogger } from "../src/logger.ts";

describe( "logger", () => {
	it( "createLogger returns a logger with the specified name", () => {
		const logger = createLogger( "TestLogger" );
		expect( logger.settings.name ).toBe( "TestLogger" );
	} );

	it( "createLogger returns different loggers for different names", () => {
		const loggerA = createLogger( "A" );
		const loggerB = createLogger( "B" );
		expect( loggerA.settings.name ).toBe( "A" );
		expect( loggerB.settings.name ).toBe( "B" );
		expect( loggerA ).not.toBe( loggerB );
	} );
} );
