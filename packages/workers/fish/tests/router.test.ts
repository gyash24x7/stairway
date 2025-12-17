import { call } from "@orpc/server";
import { generateId } from "@s2h/utils/generator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FishEngine } from "../src/engine.ts";
import { fish } from "../src/router.ts";
import type { Bindings } from "../src/types.ts";

describe( "Fish:Procedure:Router", () => {

	const mockEnv = {
		FISH_KV: {
			get: vi.fn()
		},
		FISH_DO: {
			idFromString: vi.fn(),
			get: vi.fn(),
			newUniqueId: vi.fn()
		}
	} as unknown as Bindings;

	const mockAuthInfo = {
		id: "user1",
		username: "fishPlayer",
		name: "Fish Player",
		avatar: "avatar.png"
	};

	const mockDurableObjectId = {
		toString: vi.fn().mockReturnValue( "durable-object-id-123" )
	} as unknown as DurableObjectId;

	const mockEngine = {
		initialize: vi.fn(),
		getPlayerData: vi.fn(),
		addPlayer: vi.fn(),
		addBots: vi.fn(),
		createTeams: vi.fn(),
		startGame: vi.fn(),
		askCard: vi.fn(),
		claimBook: vi.fn(),
		transferTurn: vi.fn()
	};

	const mockContext = { env: mockEnv, authInfo: mockAuthInfo };

	beforeEach( () => {
		vi.mocked( mockEnv.FISH_KV.get ).mockResolvedValue( "durable-object-id-123" as any );
		vi.mocked( mockEnv.FISH_DO.idFromString ).mockReturnValue( mockDurableObjectId );
		vi.mocked( mockEnv.FISH_DO.get ).mockReturnValue( mockEngine as unknown as DurableObjectStub<FishEngine> );
	} );

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "Fish:Procedure:CreateGame", () => {

		it( "should create a new game and return the gameId", async () => {
			const mockGameId = "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C";
			vi.mocked( mockEngine.initialize ).mockResolvedValue( { data: mockGameId } );
			vi.mocked( mockEnv.FISH_DO.newUniqueId ).mockReturnValue( mockDurableObjectId );

			const data = await call(
				fish.createGame,
				{ playerCount: 4, type: "NORMAL", teamCount: 2 },
				{ context: mockContext }
			);

			expect( data ).toEqual( { gameId: mockGameId } );
			expect( mockEnv.FISH_DO.newUniqueId ).toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.initialize )
				.toHaveBeenCalledWith( { playerCount: 4, type: "NORMAL", teamCount: 2 }, mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if request body is invalid", async () => {
			const input = { playerCount: 3 as const, type: "WEIRD" as any, teamCount: 4 as const };

			expect.assertions( 4 );
			await call( fish.createGame, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_DO.newUniqueId ).not.toHaveBeenCalled();
				expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.initialize ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			vi.mocked( mockEngine.initialize ).mockResolvedValue( { error: "Unable to create game" } );
			vi.mocked( mockEnv.FISH_DO.newUniqueId ).mockReturnValue( mockDurableObjectId );

			expect.assertions( 4 );
			await call( fish.createGame, { playerCount: 4, type: "NORMAL", teamCount: 2 }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
					expect( mockEnv.FISH_DO.newUniqueId ).toHaveBeenCalled();
					expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
					expect( mockEngine.initialize )
						.toHaveBeenCalledWith( { playerCount: 4, type: "NORMAL", teamCount: 2 }, mockAuthInfo );
				} );
		} );

	} );

	describe( "Fish:Procedure:GetGameData", () => {

		it( "should fetch player data for a valid gameId", async () => {
			const mockPlayerData = { playerId: "user1", hand: [], score: 0 };
			vi.mocked( mockEngine.getPlayerData ).mockResolvedValue( { data: mockPlayerData } );

			const data = await call(
				fish.getGameData,
				{ gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" },
				{ context: mockContext }
			);

			expect( data ).toEqual( mockPlayerData );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( "user1" );
		} );

		it( "should return BAD_REQUEST if gameId is invalid", async () => {
			expect.assertions( 4 );
			await call( fish.getGameData, { gameId: "invalid-game-id" }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.getPlayerData ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			vi.mocked( mockEngine.getPlayerData ).mockResolvedValue( { error: "Unable to fetch player data" } );
			expect.assertions( 4 );
			await call( fish.getGameData, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
					expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
					expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
					expect( mockEngine.getPlayerData ).toHaveBeenCalledWith( "user1" );
				} );
		} );

		it( "should return NOT__FOUND if key not found in KV", async () => {
			vi.mocked( mockEnv.FISH_KV.get ).mockResolvedValue( null as any );
			expect.assertions( 4 );
			await call( fish.getGameData, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
					expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
					expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
					expect( mockEngine.getPlayerData ).not.toHaveBeenCalled();
				} );
		} );

	} );

	describe( "Fish:Procedure:JoinGame", () => {

		it( "should join a game with a valid code and return the gameId", async () => {
			const mockGameId = "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C";
			vi.mocked( mockEngine.addPlayer ).mockResolvedValue( { data: mockGameId } );

			const data = await call( fish.joinGame, { code: "ABC123" }, { context: mockContext } );

			expect( data ).toEqual( { gameId: mockGameId } );
			expect( mockEnv.FISH_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addPlayer ).toHaveBeenCalledWith( mockAuthInfo );
		} );

		it( "should return NOT__FOUND if code is invalid", async () => {
			vi.mocked( mockEnv.FISH_KV.get ).mockResolvedValue( null as any );
			expect.assertions( 5 );
			await call( fish.joinGame, { code: "ABC123" }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
				expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.addPlayer ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if request body is invalid", async () => {
			expect.assertions( 5 );
			await call( fish.joinGame, { code: "TOO_LONG_CODE" as any }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_KV.get ).not.toHaveBeenCalled();
				expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.addPlayer ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			vi.mocked( mockEngine.addPlayer ).mockResolvedValue( { error: "Unable to join game" } );
			expect.assertions( 5 );
			await call( fish.joinGame, { code: "ABC123" }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_KV.get ).toHaveBeenCalledWith( "code:ABC123" );
				expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
				expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
				expect( mockEngine.addPlayer ).toHaveBeenCalledWith( mockAuthInfo );
			} );
		} );

	} );

	describe( "Fish:Procedure:AddBots", () => {

		it( "should add bots successfully", async () => {
			vi.mocked( mockEngine.addBots ).mockResolvedValue( {} );

			await call( fish.addBots, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } );

			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.addBots ).toHaveBeenCalledWith( mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if gameId is invalid", async () => {
			expect.assertions( 4 );
			await call( fish.addBots, { gameId: "invalid-game-id" }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
				expect( mockEngine.addBots ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			vi.mocked( mockEngine.addBots ).mockResolvedValue( { error: "Unable to add bots" } );
			expect.assertions( 4 );
			await call( fish.addBots, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
					expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
					expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
					expect( mockEngine.addBots ).toHaveBeenCalledWith( mockAuthInfo );
				} );
		} );
	} );

	describe( "Fish:Procedure:CreateTeams", () => {

		it( "should create teams successfully", async () => {
			vi.mocked( mockEngine.createTeams ).mockResolvedValue( {} );
			const input = {
				teams: {
					teamA: [ generateId(), generateId() ],
					teamB: [ generateId(), generateId() ]
				},
				gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C"
			};

			await call( fish.createTeams, input, { context: mockContext } );

			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.createTeams ).toHaveBeenCalledWith( input, mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if request body is invalid", async () => {
			const teams = { teamA: [ "invalid-id" as any ] };
			expect.assertions( 3 );
			await call( fish.createTeams, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C", teams }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
				} );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
		} );

		it( "should return BAD_REQUEST if gameId is invalid", async () => {
			const teams = { teamA: [ generateId() ] };
			expect.assertions( 3 );
			await call( fish.createTeams, { gameId: "invalid-game-id", teams }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
				} );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			vi.mocked( mockEngine.createTeams ).mockResolvedValue( { error: "Unable to create teams" } );
			const input = { teams: { teamA: [ generateId() ] }, gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" };

			expect.assertions( 4 );
			await call( fish.createTeams, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
				expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
				expect( mockEngine.createTeams ).toHaveBeenCalledWith( input, mockAuthInfo );
			} );
		} );
	} );

	describe( "Fish:Procedure:StartGame", () => {

		it( "should start a game successfully", async () => {
			vi.mocked( mockEngine.startGame ).mockResolvedValue( {} );

			await call( fish.startGame, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } );

			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.startGame ).toHaveBeenCalledWith( mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if gameId is invalid", async () => {
			expect.assertions( 3 );
			await call( fish.startGame, { gameId: "invalid-game-id" }, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
			} );
			expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
			expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			vi.mocked( mockEngine.startGame ).mockResolvedValue( { error: "Unable to start game" } );
			expect.assertions( 4 );
			await call( fish.startGame, { gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" }, { context: mockContext } )
				.catch( error => {
					expect( error ).toBeDefined();
					expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
					expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
					expect( mockEngine.startGame ).toHaveBeenCalledWith( mockAuthInfo );
				} );
		} );
	} );

	describe( "Fish:Procedure:AskCard", () => {

		it( "should ask a card successfully", async () => {
			vi.mocked( mockEngine.askCard ).mockResolvedValue( {} );
			const input = { from: generateId(), cardId: "5H" as const, gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" };
			await call( fish.askCard, input, { context: mockContext } );

			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.askCard ).toHaveBeenCalledWith( input, mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if request body is invalid", async () => {
			const input = { from: "invalid-id", cardId: "XX" as any, gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" };

			expect.assertions( 3 );
			await call( fish.askCard, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			vi.mocked( mockEngine.askCard ).mockResolvedValue( { error: "Unable to ask card" } );
			const input = { from: generateId(), cardId: "5H" as const, gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" };

			expect.assertions( 4 );
			await call( fish.askCard, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
				expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
				expect( mockEngine.askCard ).toHaveBeenCalledWith( input, mockAuthInfo );
			} );
		} );
	} );

	describe( "Fish:Procedure:ClaimBook", () => {

		it( "should claim book successfully", async () => {
			vi.mocked( mockEngine.claimBook ).mockResolvedValue( {} );

			const input = { claim: { "5H": generateId() }, gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" };
			await call( fish.claimBook, input, { context: mockContext } );

			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.claimBook ).toHaveBeenCalledWith( input, mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if request body is invalid", async () => {
			const input = { claim: { "XX": "invalid-id" }, gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" } as any;

			expect.assertions( 3 );
			await call( fish.claimBook, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			vi.mocked( mockEngine.claimBook ).mockResolvedValue( { error: "Unable to claim book" } );
			const input = { claim: { "5H": generateId() }, gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" };

			expect.assertions( 4 );
			await call( fish.claimBook, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
				expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
				expect( mockEngine.claimBook ).toHaveBeenCalledWith( input, mockAuthInfo );
			} );
		} );
	} );

	describe( "Fish:Procedure:TransferTurn", () => {

		it( "should transfer turn successfully", async () => {
			vi.mocked( mockEngine.transferTurn ).mockResolvedValue( {} );
			const input = { transferTo: generateId(), gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" };
			await call( fish.transferTurn, input, { context: mockContext } );

			expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
			expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
			expect( mockEngine.transferTurn ).toHaveBeenCalledWith( input, mockAuthInfo );
		} );

		it( "should return BAD_REQUEST if request body is invalid", async () => {
			const input = { transferTo: "invalid-id", gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" } as any;

			expect.assertions( 3 );
			await call( fish.transferTurn, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_DO.idFromString ).not.toHaveBeenCalled();
				expect( mockEnv.FISH_DO.get ).not.toHaveBeenCalled();
			} );
		} );

		it( "should return BAD_REQUEST if engine returns an error", async () => {
			vi.mocked( mockEngine.transferTurn ).mockResolvedValue( { error: "Unable to transfer turn" } );
			const input = { transferTo: generateId(), gameId: "01FZ8Z5Y3X5G6Z7X8Y9Z0A1B2C" };

			expect.assertions( 4 );
			await call( fish.transferTurn, input, { context: mockContext } ).catch( error => {
				expect( error ).toBeDefined();
				expect( mockEnv.FISH_DO.idFromString ).toHaveBeenCalledWith( "durable-object-id-123" );
				expect( mockEnv.FISH_DO.get ).toHaveBeenCalledWith( mockDurableObjectId );
				expect( mockEngine.transferTurn ).toHaveBeenCalledWith( input, mockAuthInfo );
			} );
		} );
	} );

} );
