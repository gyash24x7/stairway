import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import { LoginCommand, LoginCommandHandler } from "../../src/commands";
import type { LoginInput, User } from "@auth/types";
import type { HttpException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import type { JwtService } from "@nestjs/jwt";

describe( "LoginCommandHandler", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockJwtService = mockDeep<JwtService>();

	const mockInput: LoginInput = {
		email: "test@email.com",
		password: "some-password"
	};

	const mockUser: User = {
		...mockInput,
		name: "Mock User",
		id: "createdId",
		avatar: "avatar",
		verified: false,
		salt: "",
		password: bcrypt.hashSync( mockInput.password, 15 )
	};

	it( "should throw an error if user is not found", async () => {
		mockPrisma.user.findUnique.mockResolvedValue( null );
		const loginCommandHandler = new LoginCommandHandler( mockPrisma, mockJwtService );

		expect.assertions( 2 );
		await loginCommandHandler.execute( new LoginCommand( mockInput ) ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 404 );
			expect( mockPrisma.user.findUnique ).toHaveBeenCalledWith( { where: { email: mockInput.email } } );
		} );
	} );

	it( "should throw an error if user is not verified", async () => {
		mockPrisma.user.findUnique.mockResolvedValue( mockUser );
		const loginCommandHandler = new LoginCommandHandler( mockPrisma, mockJwtService );

		expect.assertions( 2 );
		await loginCommandHandler.execute( new LoginCommand( mockInput ) ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toBe( 400 );
			expect( mockPrisma.user.findUnique ).toHaveBeenCalledWith( { where: { email: mockInput.email } } );
		} );
	} );

	it( "should throw an error if passwords do not match", async () => {
		mockPrisma.user.findUnique.mockResolvedValue( { ...mockUser, verified: true } );
		const loginCommandHandler = new LoginCommandHandler( mockPrisma, mockJwtService );

		expect.assertions( 2 );
		await loginCommandHandler.execute( new LoginCommand( { ...mockInput, password: "wrongPass" } ) )
			.catch( ( err: HttpException ) => {
				expect( err.getStatus() ).toBe( 400 );
				expect( mockPrisma.user.findUnique ).toHaveBeenCalledWith( { where: { email: mockInput.email } } );
			} );
	} );

	it( "should sign a new token and return AuthTokenData", async () => {
		mockPrisma.user.findUnique.mockResolvedValue( { ...mockUser, verified: true } );
		const loginCommandHandler = new LoginCommandHandler( mockPrisma, mockJwtService );

		const data = await loginCommandHandler.execute( new LoginCommand( mockInput ) );
		expect( mockPrisma.user.findUnique ).toHaveBeenCalledWith( { where: { email: mockInput.email } } );
		expect( mockJwtService.signAsync ).toHaveBeenCalledWith( { ...mockUser, verified: true } );
		expect( data.userId ).toEqual( mockUser.id );

	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockJwtService );
	} );

} );