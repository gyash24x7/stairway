import type { ExecutionContext } from "@nestjs/common";
import type { HttpArgumentsHost } from "@nestjs/common/interfaces";
import type { PrismaService } from "@s2h/core";
import { AuthGuard } from "@s2h/core";
import type { Response } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { Constants } from "../../src/auth/auth.constants";

describe( "AuthGuard", () => {

	const mockResponse = mockDeep<Response>();
	const mockHttpArgumentsHost = mockDeep<HttpArgumentsHost>();
	const mockExecutionCtx = mockDeep<ExecutionContext>();

	const mockPrisma = mockDeep<PrismaService>();

	it( "should return false if no user id", async () => {
		mockResponse.locals[ Constants.AUTH_USER_ID ] = undefined;
		mockHttpArgumentsHost.getResponse.mockReturnValue( mockResponse );
		mockExecutionCtx.switchToHttp.mockReturnValue( mockHttpArgumentsHost );
		const authGuard = new AuthGuard( mockPrisma );
		const response = await authGuard.canActivate( mockExecutionCtx );

		expect( response ).toBeFalsy();
		expect( mockPrisma.user.findUnique ).toHaveBeenCalledTimes( 0 );
		expect( mockHttpArgumentsHost.getResponse ).toHaveBeenCalled();
		expect( mockExecutionCtx.switchToHttp ).toHaveBeenCalled();

	} );

	it( "should return false if user id present but no user", async () => {
		mockResponse.locals[ Constants.AUTH_USER_ID ] = "userId";
		mockHttpArgumentsHost.getResponse.mockReturnValue( mockResponse );
		mockExecutionCtx.switchToHttp.mockReturnValue( mockHttpArgumentsHost );
		mockPrisma.user.findUnique.mockResolvedValue( null );

		const authGuard = new AuthGuard( mockPrisma );
		const response = await authGuard.canActivate( mockExecutionCtx );

		expect( response ).toBeFalsy();
		expect( mockPrisma.user.findUnique ).toHaveBeenCalledWith( { where: { id: "userId" } } );
		expect( mockHttpArgumentsHost.getResponse ).toHaveBeenCalled();
		expect( mockExecutionCtx.switchToHttp ).toHaveBeenCalled();

	} );

	it( "should return true if user present", async () => {

		mockResponse.locals[ Constants.AUTH_USER_ID ] = "userId";
		mockHttpArgumentsHost.getResponse.mockReturnValue( mockResponse );
		mockExecutionCtx.switchToHttp.mockReturnValue( mockHttpArgumentsHost );
		mockPrisma.user.findUnique.mockResolvedValue( mockDeep() );

		const authGuard = new AuthGuard( mockPrisma );
		const response = await authGuard.canActivate( mockExecutionCtx );

		expect( response ).toBeTruthy();
		expect( mockPrisma.user.findUnique ).toHaveBeenCalledWith( { where: { id: "userId" } } );
		expect( mockHttpArgumentsHost.getResponse ).toHaveBeenCalled();
		expect( mockExecutionCtx.switchToHttp ).toHaveBeenCalled();
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockExecutionCtx );
		mockClear( mockHttpArgumentsHost );
		mockClear( mockResponse );
	} );
} );