import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import type { DeepMockProxy } from "vitest-mock-extended";
import { mockDeep } from "vitest-mock-extended";
import { handleGetLoggedInUser } from "src";
import { IUser } from "libs/utils/src";

describe( "Logged In User Handler", () => {

	it( "should return logged in user", () => {
		const handler = handleGetLoggedInUser();
		const reqMock: DeepMockProxy<Request> = mockDeep();

		const user: IUser = { name: "name", email: "email", id: "id", avatar: "", salt: "" };

		const resMock = mockDeep<Response>();
		resMock.locals[ "user" ] = user;
		resMock.send.mockReturnValue( resMock );

		handler( reqMock, resMock );

		expect( resMock.send ).toHaveBeenCalledWith( expect.objectContaining( { ...user } ) );
	} );
} );