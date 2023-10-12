import { describe, expect, it } from "vitest";
import { CreateUserCommand, CreateUserCommandHandler } from "../../src/commands";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "../../src/services";
import type { CreateUserInput, User } from "@auth/data";

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
	const createUserCommandHandler = new CreateUserCommandHandler( mockPrismaService );

	it( "should create new user and return the id", async () => {
		const id = await createUserCommandHandler.execute( new CreateUserCommand( mockInput ) );

		expect( id ).toBe( mockUser.id );
		expect( mockPrismaService.user.create ).toBeCalledWith( {
			data: {
				...mockInput,
				password: expect.any( String ),
				avatar: expect.any( String ),
				salt: expect.any( String )
			}
		} );
	} );

} );