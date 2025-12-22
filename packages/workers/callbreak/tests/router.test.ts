import { call } from "@orpc/server";
import type { CardId } from "@s2h/utils/cards";
import { generateId } from "@s2h/utils/generator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallbreakEngine } from "../src/engine.ts";
import { callbreak } from "../src/router.ts";
import type { Context, PlayCardInput } from "../src/types.ts";

describe( "Callbreak:Router", () => {

	const mockEnv = {
		CALLBREAK_KV: {
			get: vi.fn()
		},
		CALLBREAK_DO: {
			idFromString: vi.fn(),
			get: vi.fn(),
			newUniqueId: vi.fn()
		}
	};

	const mockAuthInfo = {
		id: "user1",
		username: "callbreakPlayer",
		name: "Callbreak Player",
		avatar: "avatar.png"
	};

	const mockContext = { env: mockEnv, authInfo: mockAuthInfo } as unknown as Context;

	const mockDurableObjectId = {
		toString: vi.fn().mockReturnValue( "durable-object-id-123" )
	} as unknown as DurableObjectId;

	const mockEngine = {
		initialize: vi.fn(),
		getPlayerData: vi.fn(),
		addPlayer: vi.fn(),
		addBots: vi.fn(),
		declareDealWins: vi.fn(),
		playCard: vi.fn()
	};

	beforeEach( () => {
		mockEnv.CALLBREAK_KV.get.mockResolvedValue( "durable-object-id-123" as any );
		mockEnv.CALLBREAK_DO.idFromString.mockReturnValue( mockDurableObjectId );
		mockEnv.CALLBREAK_DO.get.mockReturnValue( mockEngine as unknown as DurableObjectStub<CallbreakEngine> );
	} );

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "Callbreak:Procedure:CreateGame", () => {

		it( "should create a new game and return the gameId", async () => {
			const mockGameId = "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C";
			mockEngine.initialize.mockResolvedValue( { data: mockGameId } );
			mockEnv.CALLBREAK_DO.newUniqueId.mockReturnValue( mockDurableObjectId );

			const data = await call(
				callbreak.createGame,
				{ dealCount: 9, trumpSuit: "H" },
				{ context: mockContext }
			);

			expect( data ).toEqual( { gameId: mockGameId } );
			expect( mockEnv.CALLBREAK_DO.newUniqueId ).toHaveBeenCalled();
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.initialize ).toHaveBeenCalledWith( { dealCount: 9, trumpSuit: "H" }, mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if request body is invalid", async () => {
			expect.assertions( 4 );
			await call(
				callbreak.createGame,
				{ dealCount: 7, trumpSuit: "X" as any },
				{ context: mockContext }
			).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_DO.newUniqueId ).not.toHaveBeenCalled();
				expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.initialize ).not.toHaveBeenCalled();
			} );
		} );

	} );

	describe( "Callbreak:Procedure:GetGameData", () => {

		it( "should fetch player data for a valid gameId", async () => {
			const mockPlayerData = { playerId: "user1", hand: [], score: 0 };
			mockEngine.getPlayerData.mockResolvedValue( { data: mockPlayerData } );

			const data = await call(
				callbreak.getGameData,
				{ gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" },
				{ context: mockContext }
			);

			expect( data ).toEqual( mockPlayerData );
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( "user1" );
		} );

		it( "should return BAD_REQUEST if gameId is invalid", async () => {
			expect.assertions( 4 );
			await call( callbreak.getGameData, { gameId: "invalid-game-id" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
					expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
					expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
					expect( mockEngine.getPlayerData ).not.toHaveBeenCalled();
				} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			mockEngine.getPlayerData.mockResolvedValue( { error: "Unable to fetch player data" } );
			expect.assertions( 4 );
			await call( callbreak.getGameData, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
					expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
					expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
					expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( "user1" );
				} );
		} );

		it( "should return NOT_FOUND if key not found in KV", async () => {
			mockEnv.CALLBREAK_KV.get.mockResolvedValue( null as any );
			expect.assertions( 4 );
			await call( callbreak.getGameData, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
					expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
					expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
					expect( mockEngine.getPlayerData ).not.toHaveBeenCalled();
				} );
		} );

	} );

	describe( "Callbreak:Procedure:JoinGame", () => {

		it( "should join a game with a valid code and return the gameId", async () => {
			const mockGameId = "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C";
			mockEngine.addPlayer.mockResolvedValue( { data: mockGameId } );

			const data = await call( callbreak.joinGame, { code: "ABC123" }, { context: mockContext } );
			expect( data ).toEqual( { gameId: mockGameId } );
			expect( mockEnv.CALLBREAK_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addPlayer ).toHaveBeenCalledWith( mockAuthInfo );
		} );

		it( "should return NOT_FOUND if code is invalid", async () => {
			mockEnv.CALLBREAK_KV.get.mockResolvedValue( null as any );
			expect.assertions( 5 );
			await call( callbreak.joinGame, { code: "ABC123" }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
				expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.addPlayer ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if request body is invalid", async () => {
			expect.assertions( 5 );
			await call( callbreak.joinGame, { code: "TOO_LONG_CODE" }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_KV.get ).not.toHaveBeenCalled();
				expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.addPlayer ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			mockEngine.addPlayer.mockResolvedValue( { error: "Unable to join game" } );
			expect.assertions( 5 );
			await call( callbreak.joinGame, { code: "ABC123" }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
				expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
				expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
				expect( mockEngine.addPlayer ).toHaveBeenCalledWith( mockAuthInfo );
			} );
		} );

	} );

	describe( "Callbreak:Procedure:AddBots", () => {

		it( "should add bots successfully", async () => {
			mockEngine.addBots.mockResolvedValue( {} );
			await call( callbreak.addBots, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } );
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addBots ).toHaveBeenCalledWith( mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if gameId is invalid", async () => {
			expect.assertions( 4 );
			await call( callbreak.addBots, { gameId: "invalid-game-id" }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.addBots ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			mockEngine.addBots.mockResolvedValue( { error: "Unable to add bots" } );
			expect.assertions( 4 );
			await call( callbreak.addBots, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
					expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
					expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
					expect( mockEngine.addBots ).toHaveBeenCalledWith( mockAuthInfo );
				} );
		} );

	} );

	describe( "Callbreak:Procedure:DeclareDealWins", () => {

		it( "should declare deal wins successfully", async () => {
			mockEngine.declareDealWins.mockResolvedValue( {} );

			const input = { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C", wins: 5, dealId: generateId() };
			await call( callbreak.declareDealWins, input, { context: mockContext } );
			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.declareDealWins )
				.toHaveBeenCalledWith( { wins: 5, dealId: input.dealId, gameId: input.gameId }, mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if request body is invalid", async () => {
			const input = { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C", wins: 15, dealId: "invalid-deal-id" };
			expect.assertions( 4 );
			await call( callbreak.declareDealWins, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.declareDealWins ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if gameId is invalid", async () => {
			const input = { gameId: "invalid-game-id", wins: 5, dealId: generateId() };
			expect.assertions( 4 );
			await call( callbreak.declareDealWins, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.declareDealWins ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			mockEngine.declareDealWins.mockResolvedValue( { error: "Unable to declare wins" } );
			const input = { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C", wins: 5, dealId: generateId() };
			expect.assertions( 4 );
			await call( callbreak.declareDealWins, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
				expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
				expect( mockEngine.declareDealWins ).toHaveBeenCalledWith( input, mockAuthInfo );
			} );
		} );

	} );

	describe( "Callbreak:Procedure:PlayCard", () => {

		it( "should play a card successfully", async () => {
			mockEngine.playCard.mockResolvedValue( {} );

			const input: PlayCardInput = {
				cardId: "5H",
				dealId: generateId(),
				roundId: generateId(),
				gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C"
			};

			await call( callbreak.playCard, input, { context: mockContext } );

			expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.playCard ).toHaveBeenCalledWith( input, mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if request body is invalid", async () => {
			const input: PlayCardInput = {
				cardId: "XX" as CardId,
				dealId: "invalid-deal-id",
				roundId: "invalid-round-id",
				gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C"
			};

			expect.assertions( 4 );
			await call( callbreak.playCard, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.playCard ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if gameId is invalid", async () => {
			const input: PlayCardInput = {
				cardId: "5H" as const,
				dealId: generateId(),
				roundId: generateId(),
				gameId: "invalid-game-id"
			};

			expect.assertions( 4 );
			await call( callbreak.playCard, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.CALLBREAK_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.playCard ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			mockEngine.playCard.mockResolvedValue( { error: "Unable to play card" } );

			const input: PlayCardInput = {
				cardId: "5H",
				dealId: generateId(),
				roundId: generateId(),
				gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C"
			};

			expect.assertions( 4 );
			await call( callbreak.playCard, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.CALLBREAK_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
				expect( mockEnv.CALLBREAK_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
				expect( mockEngine.playCard ).toHaveBeenCalledWith( input, mockAuthInfo );
			} );
		} );

	} );

} );

