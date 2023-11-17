import { green, yellow } from "colorette";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { LoggerFactory, loggerMiddleware } from "../../src";
import type { LoggerService } from "../../src/logger/logger.service";

describe( "Logger Middleware", () => {
	const mockRequest = mockDeep<Request>();
	const mockResponse = mockDeep<Response>();
	const mockNextFn = vi.fn();
	const mockLoggerService = mockDeep<LoggerService>();
	const mockGetLogger = vi.fn().mockReturnValue( mockLoggerService );
	LoggerFactory.getLogger = mockGetLogger;

	it( "should log incoming requests", () => {
		mockRequest.method = "GET";
		mockRequest.path = "/api/test";

		const middleware = loggerMiddleware();

		middleware( mockRequest, mockResponse, mockNextFn );

		expect( mockGetLogger ).toHaveBeenCalled();
		expect( mockLoggerService.info ).toHaveBeenCalledWith( `${ green( "GET" ) } ${ yellow( "/api/test" ) }` );
		expect( mockNextFn ).toHaveBeenCalled();
	} );
} );