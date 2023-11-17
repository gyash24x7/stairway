import type { Ogma } from "@ogma/logger";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { LoggerService } from "../../src/logger/logger.service";

describe( "Logger Service", () => {
	let mockOgma = mockDeep<Ogma>();

	it( "should call log methods on base ogma logger", () => {
		const loggerService = new LoggerService( mockOgma, "test" );

		loggerService.log( "Test Log: %o", { key: "value" } );
		expect( mockOgma.info ).toHaveBeenCalled();

		loggerService.debug( "Test Log: %o", { key: "value" } );
		expect( mockOgma.debug ).toHaveBeenCalled();

		loggerService.info( "Test Log: %o", { key: "value" } );
		expect( mockOgma.info ).toHaveBeenCalled();

		loggerService.error( "Test Log: %o", { key: "value" } );
		expect( mockOgma.error ).toHaveBeenCalled();

		loggerService.warn( "Test Log: %o", { key: "value" } );
		expect( mockOgma.warn ).toHaveBeenCalled();

		loggerService.verbose( "Test Log: %o", { key: "value" } );
		expect( mockOgma.verbose ).toHaveBeenCalled();

		loggerService.trace( "Test Log: %o", { key: "value" } );
		expect( mockOgma.verbose ).toHaveBeenCalled();
	} );

	afterEach( () => {
		mockClear( mockOgma );
	} );
} );