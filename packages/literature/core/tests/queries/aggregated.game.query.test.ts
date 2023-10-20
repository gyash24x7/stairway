import { expect, test } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import { AggregatedGameQuery, AggregatedGameQueryHandler } from "../../src/queries";
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
import { buildCardMappingsAndHandMap } from "../../src/utils";

test( "AggregateGameQuery should return aggregated game data", async () => {
	const mockPrisma = mockDeep<PrismaService>();
	const cardMappings = deck.map( ( card, index ) => {
		return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
	} );

	const { cardMappingMap, handMap } = buildCardMappingsAndHandMap( cardMappings );

	mockPrisma.literature.game.findUniqueOrThrow.mockResolvedValue( {
		id: "1",
		status: "IN_PROGRESS",
		teams: [ mockTeamA, mockTeamB ],
		players: [ mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4 ],
		cardMappings,
		moves: [ mockTransferMove, mockCallMove, mockAskMove ]
	} as any );

	const handler = new AggregatedGameQueryHandler( mockPrisma );
	const query = new AggregatedGameQuery( "1" );

	const result = await handler.execute( query );
	expect( result.id ).toEqual( "1" );
	expect( result.status ).toEqual( "IN_PROGRESS" );
	expect( result.teams ).toEqual( {
		[ mockTeamA.id ]: mockTeamA,
		[ mockTeamB.id ]: mockTeamB
	} );
	expect( result.players ).toEqual( {
		[ mockPlayer1.id ]: mockPlayer1,
		[ mockPlayer2.id ]: mockPlayer2,
		[ mockPlayer3.id ]: mockPlayer3,
		[ mockPlayer4.id ]: mockPlayer4
	} );
	expect( result.cardMappings ).toEqual( cardMappingMap );
	expect( result.hands ).toEqual( handMap );
	expect( result.moves ).toEqual( [ mockTransferMove, mockCallMove, mockAskMove ] );
} );