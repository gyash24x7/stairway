import { LiteratureRouter, literatureRouter as router } from "@s2h/literature/router";
import { inferProcedureInput } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";

describe( "Create Game Mutation", function () {

	let gameData: MockLitGameData;
	let player: LitPlayer;
	let mockLoggedInUser: User;
	let mockCtx: LitMockContext;

	beforeEach( function () {
		gameData = new MockLitGameData();
		player = gameData.generatePlayer();
		mockLoggedInUser = createMockUser( player.userId, player.name );
		mockCtx = createMockContext( mockLoggedInUser );
		mockCtx.prisma.litGame.create.mockResolvedValue( gameData );
		mockCtx.prisma.litPlayer.create.mockResolvedValue( player );
	} );

	it( "should create new game with provided player count", async function () {
		gameData.playerCount = 6;
		mockCtx.prisma.litGame.create.mockResolvedValue( gameData );
		const input: inferProcedureInput<LiteratureRouter["createGame"]> = { playerCount: 6 };
		const game = await router.createCaller( mockCtx ).createGame( input );

		expect( game.id ).toBe( gameData.id );
		expect( game.playerCount ).toBe( 6 );
		expect( mockCtx.prisma.litGame.create ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.objectContaining( {
					createdById: mockLoggedInUser.id,
					playerCount: 6
				} )
			} )
		);

		expect( mockCtx.prisma.litPlayer.create ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.objectContaining( {
					name: player.name,
					avatar: player.avatar,
					hand: { cards: [] }
				} )
			} )
		);
	} );

	it( "should create new game with 2 player count when not provided", async function () {
		const input: inferProcedureInput<LiteratureRouter["createGame"]> = {};
		const game = await router.createCaller( mockCtx ).createGame( input );

		expect( game.id ).toBe( gameData.id );
		expect( game.playerCount ).toBe( 2 );
		expect( mockCtx.prisma.litGame.create ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.objectContaining( {
					createdById: mockLoggedInUser.id,
					playerCount: undefined
				} )
			} )
		);

		expect( mockCtx.prisma.litPlayer.create ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.objectContaining( {
					name: player.name,
					avatar: player.avatar,
					hand: { cards: [] }
				} )
			} )
		);
	} );
} );