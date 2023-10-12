import { expect, test, vi } from "vitest";
import { loggerMiddleware } from "@s2h/core";
import { mockDeep } from "vitest-mock-extended";
import type { Request, Response } from "express";

test( "Logger Middleware should log incoming requests", () => {
	const middlewareFn = loggerMiddleware();
	const mockReq = mockDeep<Request>();
	const mockRes = mockDeep<Response>();
	const mockNextFn = vi.fn();

	middlewareFn( mockReq, mockRes, mockNextFn );
	expect( mockNextFn ).toHaveBeenCalled();
} );