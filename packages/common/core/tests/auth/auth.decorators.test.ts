import type { ExecutionContext } from "@nestjs/common";
import type { HttpArgumentsHost } from "@nestjs/common/interfaces";
import type { User } from "@prisma/client";
import { authUserDecoratorFn } from "@s2h/core";
import type { Response } from "express";
import { expect, test } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { Constants } from "../../src/auth/auth.constants";

test( "AuthUser decorator function should take authInfo from res.locals", () => {
	const mockAuthInfo = mockDeep<User>();
	const mockRes = mockDeep<Response>();
	mockRes.locals[ Constants.AUTH_USER ] = mockAuthInfo;

	const mockHttpArgumentsHost = mockDeep<HttpArgumentsHost>();
	mockHttpArgumentsHost.getResponse.mockReturnValue( mockRes );

	const mockExecutionContext = mockDeep<ExecutionContext>();
	mockExecutionContext.switchToHttp.mockReturnValue( mockHttpArgumentsHost );

	const authInfo = authUserDecoratorFn( {}, mockExecutionContext );

	expect( authInfo ).toEqual( mockAuthInfo );
	expect( mockHttpArgumentsHost.getResponse ).toHaveBeenCalledOnce();
	expect( mockExecutionContext.switchToHttp ).toHaveBeenCalledOnce();
} );