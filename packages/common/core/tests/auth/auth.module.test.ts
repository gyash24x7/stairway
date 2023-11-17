import type { MiddlewareConsumer } from "@nestjs/common";
import type { MiddlewareConfigProxy } from "@nestjs/common/interfaces";
import { AuthModule } from "@s2h/core";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { AuthMiddleware } from "../../src/auth/auth.middleware";

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