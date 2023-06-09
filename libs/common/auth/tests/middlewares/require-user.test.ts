import { requireUser } from "src";
import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { Db, IUser } from "libs/utils/src";
import { Connection, RSingleSelection, RTable } from "rethinkdb-ts";

describe( "Require User Middleware", () => {

	const mockNextFn = vi.fn();
	const mockReq = mockDeep<Request>();
	const mockRes = mockDeep<Response>();

	const mockUser: IUser = {
		name: "Mock User",
		id: "subject",
		email: "mock@email.com",
		avatar: "",
		salt: "random-salt"
	};

	const mockConnection = mockDeep<Connection>();
	const mockDb = mockDeep<Db>();
	const mockUsersTable = mockDeep<RTable<IUser>>();
	const mockRSingleSelect = mockDeep<RSingleSelection<IUser | null>>();

	afterEach( () => {
		mockReset( mockNextFn );
		mockReset( mockConnection );
		mockReset( mockDb );
		mockReset( mockUsersTable );
		mockReset( mockRSingleSelect );
		mockReset( mockReq );
		mockReset( mockRes );
	} );

	it( "should return 403 when userId not present", async () => {
		mockRes.locals[ "userId" ] = undefined;
		const middleware = requireUser( mockConnection, mockDb );

		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockRes.sendStatus ).toHaveBeenCalledWith( 403 );
	} );

	it( "should return 403 when user not found", async () => {
		mockRes.locals[ "userId" ] = "mock-user-id";
		mockRSingleSelect.run.mockResolvedValue( null );
		mockUsersTable.get.mockReturnValue( mockRSingleSelect );
		mockDb.users.mockReturnValue( mockUsersTable );

		const middleware = requireUser( mockConnection, mockDb );
		await middleware( mockReq, mockRes, mockNextFn );

		expect( mockDb.users ).toHaveBeenCalled();
		expect( mockUsersTable.get ).toHaveBeenCalledWith( "mock-user-id" );
		expect( mockRSingleSelect.run ).toHaveBeenCalledWith( mockConnection );

		expect( mockRes.sendStatus ).toHaveBeenCalledWith( 403 );
	} );

	it( "should set user in locals if found and call next", async () => {
		mockRes.locals[ "userId" ] = "mock-user-id";
		mockRSingleSelect.run.mockResolvedValue( mockUser );
		mockUsersTable.get.mockReturnValue( mockRSingleSelect );
		mockDb.users.mockReturnValue( mockUsersTable );

		const middleware = requireUser( mockConnection, mockDb );
		await middleware( mockReq, mockRes, mockNextFn );

		expect( mockDb.users ).toHaveBeenCalled();
		expect( mockUsersTable.get ).toHaveBeenCalledWith( "mock-user-id" );
		expect( mockRSingleSelect.run ).toHaveBeenCalledWith( mockConnection );

		expect( mockRes.locals[ "user" ] ).toEqual( mockUser );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
	} );

} );