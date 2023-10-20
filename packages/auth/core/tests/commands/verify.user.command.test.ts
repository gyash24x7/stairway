import { afterEach, describe, expect, it } from "vitest";
import type { User, VerifyUserInput } from "@auth/data";
import bcrypt from "bcryptjs";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import { VerifyUserCommand, VerifyUserCommandHandler } from "../../src/commands";
import type { HttpException } from "@nestjs/common";

describe( "VerifyUserCommand", () => {

	const mockInput: VerifyUserInput = {
		id: "createdId",
		salt: bcrypt.genSaltSync( 15 )
	};

	const mockUser: User = {
		name: "Mock User",
		id: "createdId",
		email: "test@email.com",
		avatar: "avatar",
		verified: false,
		salt: "",
		password: bcrypt.hashSync( "some-password", mockInput.salt )
	};

	const mockPrisma = mockDeep<PrismaService>();

	it( "should throw an error if user not found", async () => {
		mockPrisma.user.findFirst.mockResolvedValueOnce( null );
		const verifyUserCommandHandler = new VerifyUserCommandHandler( mockPrisma );

		expect.assertions( 2 );
		await verifyUserCommandHandler.execute( new VerifyUserCommand( mockInput ) )
			.catch( ( err: HttpException ) => {
				expect( err.getStatus() ).toEqual( 404 );
				expect( mockPrisma.user.findFirst ).toHaveBeenCalledWith( {
					where: { id: mockInput.id, salt: mockInput.salt }
				} );
			} );
	} );

	it( "should update the user if found", async () => {
		mockPrisma.user.findFirst.mockResolvedValueOnce( mockUser );
		const verifyUserCommandHandler = new VerifyUserCommandHandler( mockPrisma );

		const userId = await verifyUserCommandHandler.execute( new VerifyUserCommand( mockInput ) );
		expect( userId ).toEqual( mockUser.id );
		expect( mockPrisma.user.findFirst ).toHaveBeenCalledWith( {
			where: { id: mockInput.id, salt: mockInput.salt }
		} );
		expect( mockPrisma.user.update ).toHaveBeenCalledWith( {
			where: { id: mockInput.id },
			data: { verified: true }
		} );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
	} );
} );