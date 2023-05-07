import type { User } from "@prisma/client";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import type { DeepMockProxy } from "vitest-mock-extended";
import { mockDeep } from "vitest-mock-extended";
import getLoggedInUser from "../../src/handlers/logged-in-user";

describe( "Logged In User Handler", function () {

	it( "should return logged in user", function () {
		const handler = getLoggedInUser();
		const reqMock: DeepMockProxy<Request> = mockDeep();

		const user: User = { name: "name", email: "email", id: "id", avatar: "", salt: "" };

		const resMock: DeepMockProxy<Response> = mockDeep();
		resMock.locals[ "user" ] = user;
		resMock.send.mockReturnValue( resMock );

		handler( reqMock, resMock );

		expect( resMock.send ).toHaveBeenCalledWith( expect.objectContaining( { ...user } ) );
	} );
} );