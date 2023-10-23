import { afterEach, describe, expect, it } from "vitest";
import { CreateUserCommand, CreateUserCommandHandler } from "../../src/commands";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import type { CreateUserInput, User } from "@auth/types";
import type { HttpException } from "@nestjs/common";
import { Messages } from "../../src/constants";

describe( "CreateUserCommandHandler", () => {

	const mockInput: CreateUserInput = {
		name: "test",
		email: "test@email.com",
		password: "test"
	};

	const mockUser: User = {
		...mockInput,
		id: "createdId",
		avatar: "avatar",
		verified: false,
		salt: ""
	};

	const mockPrismaService = mockDeep<PrismaService>();
	mockPrismaService.user.create.mockResolvedValue( mockUser );

	it( "should throw error if user already exists", async () => {
		mockPrismaService.user.findUnique.mockResolvedValue( mockUser );
		const handler = new CreateUserCommandHandler( mockPrismaService );
		const command = new CreateUserCommand( mockInput );

		expect.assertions( 3 );
		await handler.execute( command ).catch( ( error: HttpException ) => {
			expect( error.getStatus() ).toBe( 409 );
			expect( error.message ).toBe( Messages.USER_ALREADY_EXISTS );
			expect( mockPrismaService.user.findUnique ).toHaveBeenCalledWith( {
				where: { email: mockInput.email }
			} );
		} );
	} );

	it( "should create new user and return the id", async () => {
		mockPrismaService.user.findUnique.mockResolvedValue( null );
		const createUserCommandHandler = new CreateUserCommandHandler( mockPrismaService );
		const id = await createUserCommandHandler.execute( new CreateUserCommand( mockInput ) );

		expect( id ).toBe( mockUser.id );
		expect( mockPrismaService.user.findUnique ).toHaveBeenCalledWith( {
			where: { email: mockInput.email }
		} );
		expect( mockPrismaService.user.create ).toBeCalledWith( {
			data: {
				...mockInput,
				password: expect.any( String ),
				avatar: expect.any( String ),
				salt: expect.any( String )
			}
		} );
	} );

	afterEach( () => {
		mockClear( mockPrismaService );
	} );

} );