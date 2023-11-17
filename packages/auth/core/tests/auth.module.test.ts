import { AuthModule } from "@auth/core";
import type { MiddlewareConsumer } from "@nestjs/common";
import type { MiddlewareConfigProxy } from "@nestjs/common/interfaces";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { AuthMiddleware } from "../src/middlewares";

describe( "AuthModule", () => {

	const mockMiddlewareConfigProxy = mockDeep<MiddlewareConfigProxy>();
	const mockMiddlewareConsumer = mockDeep<MiddlewareConsumer>();

	it( "should apply the auth middleware", () => {
		const module = new AuthModule();
		mockMiddlewareConsumer.apply.mockReturnValue( mockMiddlewareConfigProxy );
		
		module.configure( mockMiddlewareConsumer );

		expect( mockMiddlewareConsumer.apply ).toHaveBeenCalledWith( AuthMiddleware );
		expect( mockMiddlewareConfigProxy.forRoutes ).toHaveBeenCalledWith( "*" );
	} );
} );