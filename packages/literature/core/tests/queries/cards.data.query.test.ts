import type { CardMapping } from "@literature/types";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { CardsDataQuery, CardsDataQueryHandler } from "../../src/queries";
import { CardsDataTransformer } from "../../src/transformers";
import { deck, mockPlayerIds } from "../mockdata";

describe( "CardLocationsQuery", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const transformer = new CardsDataTransformer();
	const cardMappings: CardMapping[] = deck.map( ( card, index ) => {
		return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
	} );

	it( "should fetch card player mappings", async () => {
		mockPrisma.literature.cardMapping.findMany.mockResolvedValue( cardMappings );

		const handler = new CardsDataQueryHandler( mockPrisma, transformer );
		const query = new CardsDataQuery( "1" );

		const result = await handler.execute( query );

		const randomIndex = Math.floor( Math.random() * deck.length );
		const randomCardMapping = cardMappings[ randomIndex ];

		expect( Object.keys( result.mappings ).length ).toEqual( deck.length );
		expect( Object.keys( result.hands ).length ).toEqual( 4 );
		expect( result.mappings[ randomCardMapping.cardId ] ).toEqual( randomCardMapping.playerId );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
	} );
} );

