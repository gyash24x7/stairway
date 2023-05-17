import { literatureRouter as router } from "@s2h/literature/router";
import { LiteratureGameStatus } from "@s2h/literature/utils";
import type { inferProcedureInput, TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { Messages } from "../../src/constants";
import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";

describe( "Transfer Turn Mutation", function () {

	let gameData: MockLitGameData;
	let player1: LitPlayer;
	let player2: LitPlayer;
	let player3: LitPlayer;
	let player4: LitPlayer;
	let mockCtx: LitMockContext;
	let mockLoggedInUser: User;
	let input: inferProcedureInput<typeof router["transferTurn"]>;
	let transferTurnMove: LitMove;

	beforeEach( function () {
		gameData = new MockLitGameData( { playerCount: 4 } );
		gameData.generatePlayer();
		gameData.generatePlayer();
		gameData.generatePlayer();
		gameData.generatePlayer();
		gameData.generateTeams();
		[ player1, player2, player3, player4 ] = gameData.dealCards();

		mockLoggedInUser = createMockUser( player1.userId, player1.name );
		mockCtx = createMockContext( mockLoggedInUser );
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );

		input = { gameId: gameData.id };

	} );

	it( "should throw error if player has cards", async function () {
		expect.assertions( 3 );
		return router.createCaller( mockCtx ).transferTurn( input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.INVALID_TRANSFER );

				expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
					expect.objectContaining( {
						where: expect.objectContaining( { id: gameData.id } )
					} )
				);
			} );
	} );

	it( "should complete the game if none of the players have cards", async function () {
		player1.hand = { cards: [] };
		player2.hand = { cards: [] };
		player3.hand = { cards: [] };
		player4.hand = { cards: [] };
		gameData.players = [ player1, player2, player3, player4 ];
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
		mockCtx.prisma.litGame.update.mockResolvedValue( { ...gameData, status: LiteratureGameStatus.COMPLETED } );

		const game = await router.createCaller( mockCtx ).transferTurn( input );
		expect( game.status ).toBe( LiteratureGameStatus.COMPLETED );

		expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: gameData.id } )
			} )
		);

		expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: gameData.id,
				status: LiteratureGameStatus.COMPLETED
			} )
		);
	} );

	it( "should transfer chance to team member of same team if they have cards", async function () {
		player1.hand = { cards: [] };
		gameData.players = [ player1, player2, player3, player4 ];
		transferTurnMove = gameData.generateMove( LitMoveType.TURN, { turnPlayer: player2 }, false );
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
		mockCtx.prisma.litMove.create.mockResolvedValue( transferTurnMove );

		const game = await router.createCaller( mockCtx ).transferTurn( input );
		expect( game.id ).toBe( gameData.id );
		expect( player1.teamId ).toBe( player2.teamId );

		expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: gameData.id } )
			} )
		);

		expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
			expect.objectContaining( { id: gameData.id } )
		);

		expect( mockCtx.prisma.litMove.create ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.objectContaining( { turnId: player2.id } )
			} )
		);
	} );

	it( "should transfer chance to opposite team if same team doesn't have cards", async function () {
		player1.hand = { cards: [] };
		player2.hand = { cards: [] };
		player3.hand = { cards: [] };
		gameData.players = [ player1, player2, player3, player4 ];
		transferTurnMove = gameData.generateMove( LitMoveType.TURN, { turnPlayer: player4 }, false );
		mockCtx.prisma.litGame.findUnique.mockResolvedValue( gameData );
		mockCtx.prisma.litMove.create.mockResolvedValue( transferTurnMove );

		const game = await router.createCaller( mockCtx ).transferTurn( input );
		expect( game.id ).toBe( gameData.id );
		expect( player1.teamId === player4.teamId ).toBeFalsy();

		expect( mockCtx.prisma.litGame.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { id: gameData.id } )
			} )
		);

		expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
			expect.objectContaining( { id: gameData.id } )
		);

		expect( mockCtx.prisma.litMove.create ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.objectContaining( { turnId: player4.id } )
			} )
		);
	} );

} );