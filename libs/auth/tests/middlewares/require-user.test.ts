import { requireUser } from "@s2h/auth";
import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

describe( "Require User Middleware", function () {

	const mockNextFn = vi.fn();
	const mockPrisma = mockDeep<PrismaClient>();
	const mockReq = mockDeep<Request>();
	const mockRes = mockDeep<Response>();

	const mockUser: User = {
		name: "Mock User",
		id: "subject",
		email: "mock@email.com",
		avatar: "",
		salt: "random-salt"
	};

	afterEach( function () {
		mockReset( mockNextFn );
		mockReset( mockPrisma );
		mockReset( mockReq );
		mockReset( mockRes );
	} );

	it( "should return 403 when userId not present", async function () {
		mockRes.locals[ "userId" ] = undefined;
		const middleware = requireUser( mockPrisma );

		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockRes.sendStatus ).toHaveBeenCalledWith( 403 );
	} );

	it( "should return 403 when user not found", async function () {
		mockRes.locals[ "userId" ] = "mock-user-id";
		mockPrisma.user.findUnique.mockResolvedValue( null );
		const middleware = requireUser( mockPrisma );

		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockPrisma.user.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( {
					id: "mock-user-id"
				} )
			} )
		);
		expect( mockRes.sendStatus ).toHaveBeenCalledWith( 403 );

	} );

	it( "should set user in locals if found and call next", async function () {
		mockRes.locals[ "userId" ] = "mock-user-id";
		mockPrisma.user.findUnique.mockResolvedValue( mockUser );
		const middleware = requireUser( mockPrisma );

		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockPrisma.user.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( {
					id: "mock-user-id"
				} )
			} )
		);
		expect( mockRes.locals[ "user" ] ).toEqual( mockUser );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
	} );

} );