import type { CardMapping } from "@literature/types";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { CardMappingsQuery, CardMappingsQueryHandler } from "../../src/queries";
import { deck, mockPlayerIds } from "../mockdata";

describe( "CardMappingsQuery", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const cardMappings: CardMapping[] = deck.map( ( card, index ) => {
		return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
	} );

	it( "should fetch card player mappings", async () => {
		mockPrisma.literature.cardMapping.findMany.mockResolvedValue( cardMappings );

		const handler = new CardMappingsQueryHandler( mockPrisma );
		const query = new CardMappingsQuery( "1" );

		const result = await handler.execute( query );

		const randomIndex = Math.floor( Math.random() * deck.length );
		const randomCardMapping = cardMappings[ randomIndex ];

		expect( Object.keys( result ).length ).toEqual( deck.length );
		expect( result[ randomCardMapping.cardId ] ).toEqual( randomCardMapping.playerId );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
	} );
} );

