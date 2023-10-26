import { afterEach, describe, expect, it } from "vitest";
import { buildMockCardMappings, buildMockGameData, mockAuthInfo, mockTeamA, mockTeamB } from "../mockdata";
import { GameStatus } from "@literature/types";
import { PlayerSpecificDataQuery, PlayerSpecificDataQueryHandler } from "../../src/queries";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import { getCardSetsInHand } from "@s2h/cards";
import { buildCardMappingData, buildHandData } from "../../src/utils";

describe( "PlayerSpecificGameQuery", () => {

	const mockPrisma = mockDeep<PrismaService>();

	it( "should return the current game data for the player when teams not created", async () => {
		const mockGameData = buildMockGameData( GameStatus.PLAYERS_READY );
		mockPrisma.literature.cardMapping.findMany.mockResolvedValue( [] );

		const handler = new PlayerSpecificDataQueryHandler( mockPrisma );
		const query = new PlayerSpecificDataQuery( mockGameData, mockAuthInfo.id );

		const result = await handler.execute( query );
		expect( result ).toEqual(
			expect.objectContaining( {
				id: "1",
				oppositeTeamId: undefined,
				hand: [],
				cardSets: []
			} )
		);

		expect( mockPrisma.literature.cardMapping.findMany ).toHaveBeenCalledWith( {
			where: { gameId: mockGameData.id, playerId: mockAuthInfo.id }
		} );
	} );

	it( "should return the current game data for the player when teams created", async () => {
		const cardMappings = buildMockCardMappings();
		const cardMappingsForPlayer = cardMappings.filter( cardMapping => cardMapping.playerId === mockAuthInfo.id );
		const hands = buildHandData( buildCardMappingData( cardMappings ) );
		mockPrisma.literature.cardMapping.findMany.mockResolvedValue( cardMappingsForPlayer );

		const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS, cardMappings );
		const handler = new PlayerSpecificDataQueryHandler( mockPrisma );
		const query = new PlayerSpecificDataQuery( mockGameData, mockAuthInfo.id );

		const result = await handler.execute( query );

		expect( result.teamId ).toEqual( mockTeamA.id );
		expect( result.oppositeTeamId ).toEqual( mockTeamB.id );
		expect( result.hand ).toEqual( hands[ mockAuthInfo.id ] );
		expect( result.cardSets ).toEqual( getCardSetsInHand( hands[ mockAuthInfo.id ] ) );

		expect( mockPrisma.literature.cardMapping.findMany ).toHaveBeenCalledWith( {
			where: { gameId: mockGameData.id, playerId: mockAuthInfo.id }
		} );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
	} );
} );