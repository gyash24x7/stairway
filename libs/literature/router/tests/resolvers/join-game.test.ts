import { createMockContext, createMockUser, LitMockContext, MockLitGameData } from "../utils";
import { literatureRouter } from "@s2h/literature/router";
import type { InferMutationInput, LitTrpcContext } from "../../src/types";
import type { TRPCError } from "@trpc/server";
import { Messages } from "../../src/constants";
import { LitGameStatus, LitPlayer, User } from "@prisma/client";
import { EnhancedLitPlayer } from "@s2h/literature/utils";

describe( "Join Game Mutation", function () {

	let gameData: MockLitGameData;
	let player1: LitPlayer;
	let player2: LitPlayer;
	let mockLoggedInUser: User;
	let mockCtx: LitMockContext;
	let caller: ReturnType<typeof literatureRouter.createCaller>;
	let input: InferMutationInput<"join-game">;

	beforeEach( function () {
		gameData = new MockLitGameData();
		player1 = gameData.generatePlayer();
		player2 = gameData.generatePlayer( { addToList: false } );
		mockLoggedInUser = createMockUser( player2.userId, player2.name );
		mockCtx = createMockContext( mockLoggedInUser );
		input = { code: gameData.code };
		mockCtx.prisma.litGame.findFirst.mockResolvedValue( gameData );
		mockCtx.prisma.litPlayer.create.mockResolvedValue( player2 );
		caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );
	} );

	it( "should throw error when game not found", async function () {
		mockLoggedInUser = createMockUser();
		mockCtx = createMockContext( mockLoggedInUser );
		mockCtx.prisma.litGame.findFirst.mockResolvedValue( null );
		caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );

		expect.assertions( 3 );
		return caller.mutation( "join-game", input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "NOT_FOUND" );
				expect( e.message ).toBe( Messages.GAME_NOT_FOUND );
				expect( mockCtx.prisma.litGame.findFirst ).toHaveBeenCalledWith(
					expect.objectContaining( {
						where: expect.objectContaining( { code: gameData.code } )
					} )
				);
			} );
	} );

	it( "should return the game if user already part of game", async function () {
		mockLoggedInUser = createMockUser( player1.userId, player1.name );
		mockCtx = createMockContext( mockLoggedInUser );
		mockCtx.prisma.litGame.findFirst.mockResolvedValue( gameData );
		caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );

		const game = await caller.mutation( "join-game", input );

		expect( game.id ).toBe( gameData.id );
		expect( game.players.length ).toBe( gameData.players.length );
		expect( mockCtx.prisma.litGame.findFirst ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { code: gameData.code } )
			} )
		);
		expect( mockCtx.prisma.litGame.update ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should throw error if player capacity is full", async function () {
		gameData.generatePlayer();
		mockCtx.prisma.litGame.findFirst.mockResolvedValue( gameData );
		caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );

		expect.assertions( 4 );
		return caller.mutation( "join-game", input )
			.catch( ( e: TRPCError ) => {
				expect( e.code ).toBe( "BAD_REQUEST" );
				expect( e.message ).toBe( Messages.PLAYER_CAPACITY_FULL );
				expect( mockCtx.prisma.litGame.findFirst ).toHaveBeenCalledWith(
					expect.objectContaining( {
						where: expect.objectContaining( { code: gameData.code } )
					} )
				);
				expect( mockCtx.prisma.litGame.update ).toHaveBeenCalledTimes( 0 );
			} )
	} );

	it( "should add user to the game, keep status to NOT_STARTED when player capacity not reached", async function () {
		gameData.playerCount = 4;
		mockCtx.prisma.litGame.findFirst.mockResolvedValue( gameData );
		const { name, avatar, id: userId } = mockLoggedInUser;

		mockCtx.prisma.litGame.update.mockResolvedValue( {
			...gameData,
			players: [ ...gameData.players, player2 ],
			status: LitGameStatus.NOT_STARTED
		} as any );

		caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );
		const game = await caller.mutation( "join-game", input );

		expect( game.id ).toBe( gameData.id );
		expect( game.players.length ).toBe( gameData.players.length + 1 );
		expect( game.status ).toEqual( LitGameStatus.NOT_STARTED );

		expect( mockCtx.prisma.litGame.findFirst ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { code: gameData.code } )
			} )
		);

		expect( mockCtx.prisma.litGame.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: { id: gameData.id },
				data: expect.objectContaining( {
					status: LitGameStatus.NOT_STARTED
				} )
			} )
		);

		expect( mockCtx.prisma.litPlayer.create ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.objectContaining( { name, avatar, userId, hand: { cards: [] } } )
			} )
		);

		expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: gameData.id,
				playerData: expect.objectContaining( {
					[ player2.id ]: expect.any( EnhancedLitPlayer )
				} ),
				status: LitGameStatus.NOT_STARTED
			} )
		);

	} );

	it( "should add user to the game, update status to PLAYERS_READY when player capacity reached", async function () {
		const { name, avatar, id: userId } = mockLoggedInUser;

		mockCtx.prisma.litGame.update.mockResolvedValue( {
			...gameData,
			players: [ ...gameData.players, player2 ],
			status: LitGameStatus.PLAYERS_READY
		} as any );

		caller = literatureRouter.createCaller( mockCtx as unknown as LitTrpcContext );
		const game = await caller.mutation( "join-game", input );

		expect( game.id ).toBe( gameData.id );
		expect( game.players.length ).toBe( gameData.players.length + 1 );
		expect( game.status ).toEqual( LitGameStatus.PLAYERS_READY );

		expect( mockCtx.prisma.litGame.findFirst ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( { code: gameData.code } )
			} )
		);

		expect( mockCtx.prisma.litGame.update ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: { id: gameData.id },
				data: expect.objectContaining( {
					status: LitGameStatus.PLAYERS_READY
				} )
			} )
		);

		expect( mockCtx.prisma.litPlayer.create ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.objectContaining( { name, avatar, userId, hand: { cards: [] } } )
			} )
		);

		expect( mockCtx.litGamePublisher.publish ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: gameData.id,
				playerData: expect.objectContaining( {
					[ player2.id ]: expect.any( EnhancedLitPlayer )
				} ),
				status: LitGameStatus.PLAYERS_READY
			} )
		);

	} );
} );