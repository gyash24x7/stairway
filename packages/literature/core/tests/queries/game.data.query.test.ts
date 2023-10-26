import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import { GameDataQuery, GameDataQueryHandler } from "../../src/queries";
import {
	deck,
	mockAskMove,
	mockCallMove,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayer4,
	mockPlayerIds,
	mockTeamA,
	mockTeamB,
	mockTransferMove
} from "../mockdata";

describe( "GameDataQuery", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const cardMappings = deck.map( ( card, index ) => {
		return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
	} );

	it( "should fetch aggregated game data", async () => {
		mockPrisma.literature.game.findUniqueOrThrow.mockResolvedValue( {
			id: "1",
			status: "IN_PROGRESS",
			teams: [ mockTeamA, mockTeamB ],
			players: [ mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 ],
			cardMappings,
			moves: [ mockTransferMove, mockCallMove, mockAskMove ]
		} as any );

		const handler = new GameDataQueryHandler( mockPrisma );
		const query = new GameDataQuery( "1" );

		const result = await handler.execute( query );
		expect( result.id ).toEqual( "1" );
		expect( result.status ).toEqual( "IN_PROGRESS" );
		expect( result.teams ).toEqual( {
			[ mockTeamA.id ]: { ...mockTeamA, members: [ mockPlayer1.id, mockPlayer3.id ] },
			[ mockTeamB.id ]: { ...mockTeamB, members: [ mockPlayer2.id, mockPlayer4.id ] }
		} );
		expect( result.players ).toEqual( {
			[ mockPlayer1.id ]: mockPlayer1,
			[ mockPlayer2.id ]: mockPlayer2,
			[ mockPlayer3.id ]: mockPlayer3,
			[ mockPlayer4.id ]: mockPlayer4
		} );
		expect( result.moves ).toEqual( [ mockTransferMove, mockCallMove, mockAskMove ] );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
	} );

} );