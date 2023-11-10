import { CardMapping, GameStatus } from "@literature/types";
import type { EventBus } from "@nestjs/cqrs";
import type { PrismaService } from "@s2h/core";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { StartGameCommand, StartGameCommandHandler } from "../../src/commands";
import { GameStartedEvent } from "../../src/events";
import { CardsDataTransformer } from "../../src/transformers";
import { buildMockGameData, deck, mockPlayerIds } from "../mockdata";
import { buildCardsData } from "../mockdata/utils";

describe( "StartGameCommand", () => {

	const mockGameData = buildMockGameData( GameStatus.TEAMS_CREATED );
	const mockPrisma = mockDeep<PrismaService>();
	const transformer = new CardsDataTransformer();
	const mockEventBus = mockDeep<EventBus>();

	it( "should create card mappings and start the game", async () => {
		const mock = mockPrisma.literature.cardMapping.create;
		const cardMappingList: CardMapping[] = [];
		deck.forEach( ( card, index ) => {
			const cardMapping = {
				cardId: card.id,
				gameId: mockGameData.id,
				playerId: mockPlayerIds[ index % mockGameData.playerCount ]
			};
			mock.mockResolvedValueOnce( cardMapping );
			cardMappingList.push( cardMapping );
		} );

		const handler = new StartGameCommandHandler( mockPrisma, mockEventBus, transformer );
		const result = await handler.execute( new StartGameCommand( mockGameData ) );

		expect( result ).toEqual( cardMappingList );
		expect( mock ).toHaveBeenCalledTimes( deck.length );
		expect( mockEventBus.publish ).toHaveBeenCalledWith(
			new GameStartedEvent( mockGameData, buildCardsData( cardMappingList ) )
		);
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );