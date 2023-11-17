import { authInfoDecoratorFn } from "@auth/core";
import type { UserAuthInfo } from "@auth/data";
import type { ExecutionContext } from "@nestjs/common";
import type { HttpArgumentsHost } from "@nestjs/common/interfaces";
import type { Response } from "express";
import { expect, test } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { Constants } from "../../src/constants";

test( "AuthInfo decorator function should take authInfo from res.locals", () => {
	const mockAuthInfo = mockDeep<UserAuthInfo>();
	const mockRes = mockDeep<Response>();
	mockRes.locals[ Constants.AUTH_INFO ] = mockAuthInfo;

	const mockHttpArgumentsHost = mockDeep<HttpArgumentsHost>();
	mockHttpArgumentsHost.getResponse.mockReturnValue( mockRes );

	const mockExecutionContext = mockDeep<ExecutionContext>();
	mockExecutionContext.switchToHttp.mockReturnValue( mockHttpArgumentsHost );

	const authInfo = authInfoDecoratorFn( {}, mockExecutionContext );

	expect( authInfo ).toEqual( mockAuthInfo );
	expect( mockHttpArgumentsHost.getResponse ).toHaveBeenCalledOnce();
	expect( mockExecutionContext.switchToHttp ).toHaveBeenCalledOnce();
} );