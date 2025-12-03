import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { CallbreakEngine } from "../src/engine.ts";
import type { GameData } from "../src/types.ts";
import { mockPlayer1 } from "./mock-data.ts";

type CloudflareEnv = {
	CALLBREAK_KV: KVNamespace;
	WSS: DurableObjectNamespace<import("../../../api/src/wss.ts").WebsocketServer>;
}

vi.mock( "cloudflare:workers", () => ( {
	DurableObject: class {
		constructor( public ctx: DurableObjectState, public env: CloudflareEnv ) { }
	}
} ) );

vi.mock( "@s2h/utils/generator", async () => ( {
	generateId: vi.fn().mockReturnValue( "game-1" ),
	generateGameCode: vi.fn().mockReturnValue( "GAME01" ),
	generateBotInfo: vi.fn()
		.mockReturnValueOnce( ( await import("./mock-data.ts") ).mockPlayer2 )
		.mockReturnValueOnce( ( await import("./mock-data.ts") ).mockPlayer3 )
		.mockReturnValueOnce( ( await import("./mock-data.ts") ).mockPlayer4 )
} ) );

describe( "CallbreakEngine:GamePlay", () => {
	const mockKey = "mock-key";
	const mockEnv = mockDeep<CloudflareEnv>();
	const mockCtx = mockDeep<DurableObjectState>( {
		id: mockDeep<DurableObjectId>( { toString: () => mockKey } ),
		blockConcurrencyWhile: <T>( cb: () => Promise<T> ) => cb()
	} );

	const mockWss = mockDeep<DurableObjectStub<import("../../../api/src/wss.ts").WebsocketServer>>();
	const engine = new CallbreakEngine( mockCtx, mockEnv );
	const now = new Date( 2025, 11, 25 );

	beforeEach( () => {
		mockEnv.WSS.get.mockReturnValue( mockWss );
		vi.useFakeTimers();
		vi.setSystemTime( now );
	} );

	afterEach( () => {
		mockClear( mockEnv );
		mockClear( mockCtx );
	} );

	it.sequential( "should update the config, save data and set alarm for 60s", async () => {
		const { code, gameId } = await engine.updateConfig( { dealCount: 5 }, "p1" );
		expect( code ).toBe( "GAME01" );
		expect( gameId ).toBe( "game-1" );
		expect( mockEnv.CALLBREAK_KV.put ).toHaveBeenCalledTimes( 2 );
		expect( JSON.parse( mockEnv.CALLBREAK_KV.put.mock.calls[ 0 ][ 1 ] as string ) ).toEqual(
			expect.objectContaining( { code: "GAME01", id: "game-1" } )
		);
	} );

	it.sequential( "should add new player, save and broadcast the data", async () => {
		await engine.addPlayer( mockPlayer1 );
		expect( mockEnv.CALLBREAK_KV.put ).toHaveBeenCalledTimes( 1 );
		expect( JSON.parse( mockEnv.CALLBREAK_KV.put.mock.calls[ 0 ][ 1 ] as string ) ).toEqual(
			expect.objectContaining( {
				players: { p1: mockPlayer1 },
				scores: { p1: [] }
			} )
		);
		expect( mockWss.broadcast ).toHaveBeenCalled();
	} );

	it.sequential( "should add bots when alarm called when game in created state", async () => {
		await engine.alarm();
		expect( mockEnv.CALLBREAK_KV.put ).toHaveBeenCalledTimes( 1 );
		const savedData: GameData = JSON.parse( mockEnv.CALLBREAK_KV.put.mock.calls[ 0 ][ 1 ] as string );
		expect( savedData.status ).toBe( "PLAYERS_READY" );
		expect( Object.keys( savedData.players ).length ).toBe( 4 );
		expect( savedData.players[ "p2" ].isBot ).toBe( true );
		expect( savedData.players[ "p3" ].isBot ).toBe( true );
		expect( savedData.players[ "p4" ].isBot ).toBe( true );
		expect( mockWss.broadcast ).toHaveBeenCalled();
	} );


} );
