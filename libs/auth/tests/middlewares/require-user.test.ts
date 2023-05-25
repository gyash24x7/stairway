import { requireUser } from "@s2h/auth";
import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeepMockProxy, mockDeep, mockReset } from "vitest-mock-extended";
import { db, IUser } from "@s2h/utils";
import { Connection, RSingleSelection, RTable } from "rethinkdb-ts";

vi.mock( "@s2h/utils", async ( importOriginal ) => {
	const originalImport = await importOriginal<any>();
	const { mockDeep } = await import("vitest-mock-extended");
	return { ...originalImport, db: mockDeep<typeof db>() };
} );

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
	const mockedDb = db as DeepMockProxy<typeof db>;
	const mockUsersTable = mockDeep<RTable<IUser>>();
	const mockRSingleSelect = mockDeep<RSingleSelection<IUser | null>>();

	afterEach( () => {
		mockReset( mockNextFn );
		mockReset( mockConnection );
		mockReset( mockedDb );
		mockReset( mockUsersTable );
		mockReset( mockRSingleSelect );
		mockReset( mockReq );
		mockReset( mockRes );
	} );

	it( "should return 403 when userId not present", async () => {
		mockRes.locals[ "userId" ] = undefined;
		const middleware = requireUser( mockConnection );

		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockRes.sendStatus ).toHaveBeenCalledWith( 403 );
	} );

	it( "should return 403 when user not found", async () => {
		mockRes.locals[ "userId" ] = "mock-user-id";
		mockRSingleSelect.run.mockResolvedValue( null );
		mockUsersTable.get.mockReturnValue( mockRSingleSelect );
		mockedDb.users.mockReturnValue( mockUsersTable );

		const middleware = requireUser( mockConnection );
		await middleware( mockReq, mockRes, mockNextFn );

		expect( mockedDb.users ).toHaveBeenCalled();
		expect( mockUsersTable.get ).toHaveBeenCalledWith( "mock-user-id" );
		expect( mockRSingleSelect.run ).toHaveBeenCalledWith( mockConnection );
		
		expect( mockRes.sendStatus ).toHaveBeenCalledWith( 403 );
	} );

	it( "should set user in locals if found and call next", async () => {
		mockRes.locals[ "userId" ] = "mock-user-id";
		mockRSingleSelect.run.mockResolvedValue( mockUser );
		mockUsersTable.get.mockReturnValue( mockRSingleSelect );
		mockedDb.users.mockReturnValue( mockUsersTable );

		const middleware = requireUser( mockConnection );
		await middleware( mockReq, mockRes, mockNextFn );

		expect( mockedDb.users ).toHaveBeenCalled();
		expect( mockUsersTable.get ).toHaveBeenCalledWith( "mock-user-id" );
		expect( mockRSingleSelect.run ).toHaveBeenCalledWith( mockConnection );

		expect( mockRes.locals[ "user" ] ).toEqual( mockUser );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
	} );

} );