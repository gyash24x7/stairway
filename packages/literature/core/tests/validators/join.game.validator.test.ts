import { GameStatus, JoinGameInput } from "@literature/types";
import type { HttpException } from "@nestjs/common";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { JoinGameCommand } from "../../src/commands";
import { Messages } from "../../src/constants";
import { JoinGameValidator } from "../../src/validators";
import { buildMockRawGameData, mockAuthUser, mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 } from "../mockdata";

describe( "JoinGameValidator", () => {

	const mockInput: JoinGameInput = { code: "BCDEDIT" };
	const mockGame = buildMockRawGameData( GameStatus.CREATED );
	const mockPrisma = mockDeep<PrismaService>();

	it( "should throw error if game not there", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( null );

		const validator = new JoinGameValidator( mockPrisma );
		const command = new JoinGameCommand( mockInput, mockAuthUser );

		expect.assertions( 3 );
		await validator.validate( command )
			.catch( ( err: HttpException ) => {
				expect( err.getStatus() ).toEqual( 404 );
				expect( err.message ).toEqual( Messages.GAME_NOT_FOUND );
				expect( mockPrisma.literature.game.findUnique ).toHaveBeenCalledWith( {
					where: { code: mockInput.code },
					include: { players: true }
				} );
			} );
	} );

	it( "should throw error if game has enough players", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( {
			...mockGame,
			players: [ mockPlayer2, mockPlayer3, mockPlayer4, { ...mockPlayer1, id: "5" } ]
		} as any );

		const validator = new JoinGameValidator( mockPrisma );

		expect.assertions( 3 );
		await validator.validate( new JoinGameCommand( mockInput, { ...mockAuthUser, id: "1" } ) )
			.catch( ( err: HttpException ) => {
				expect( err.getStatus() ).toEqual( 400 );
				expect( err.message ).toEqual( Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS );
				expect( mockPrisma.literature.game.findUnique ).toHaveBeenCalledWith( {
					where: { code: mockInput.code },
					include: { players: true }
				} );
			} );
	} );

	it( "should return the game and user if player already part of game", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( mockGame as any );

		const command = new JoinGameCommand( mockInput, mockAuthUser );
		const validator = new JoinGameValidator( mockPrisma );
		const { game, isUserAlreadyInGame } = await validator.validate( command );

		expect( isUserAlreadyInGame ).toBeTruthy();
		expect( game.players ).toEqual( [
			{ ...mockPlayer1, teamId: null },
			{ ...mockPlayer2, teamId: null },
			{ ...mockPlayer3, teamId: null },
			{ ...mockPlayer4, teamId: null }
		] );
	} );

	it( "should return the game and even if user is not part of game", async () => {
		mockPrisma.literature.game.findUnique.mockResolvedValue( {
			...mockGame,
			playerCount: 6,
			players: [
				{ ...mockPlayer2, teamId: null },
				{ ...mockPlayer3, teamId: null },
				{ ...mockPlayer4, teamId: null }
			]
		} as any );

		const command = new JoinGameCommand( mockInput, mockAuthUser );
		const validator = new JoinGameValidator( mockPrisma );
		const { game, isUserAlreadyInGame } = await validator.validate( command );

		expect( isUserAlreadyInGame ).toBeFalsy();
		expect( game.players ).toEqual( [
			{ ...mockPlayer2, teamId: null },
			{ ...mockPlayer3, teamId: null },
			{ ...mockPlayer4, teamId: null }
		] );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
	} );

} );