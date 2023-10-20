import { describe, expect, it } from "vitest";
import {
	buildMockAggregatedGameData,
	deck,
	mockAuthInfo,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayer4,
	mockPlayerIds,
	mockTeamA,
	mockTeamB
} from "../mockdata";
import { GameStatus } from "@literature/data";
import { PlayerSpecificGameQuery, PlayerSpecificGameQueryHandler } from "../../src/queries";

describe( "PlayerSpecificGameQuery", () => {

	it( "should return the current game data for the player when teams not created", async () => {
		const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.PLAYERS_READY );
		const handler = new PlayerSpecificGameQueryHandler();
		const query = new PlayerSpecificGameQuery( mockAggregatedGameData, mockAuthInfo.id );

		const result = await handler.execute( query );
		expect( result ).toEqual(
			expect.objectContaining( {
				id: "1",
				myTeam: undefined,
				oppositeTeam: undefined,
				hand: [],
				cardCounts: {}
			} )
		);
	} );

	it( "should return the current game data for the player when teams created", async () => {
		const cardMappings = deck.map( ( card, index ) => {
			return { cardId: card.id, playerId: mockPlayerIds[ index % 4 ], gameId: "1" };
		} );

		const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.IN_PROGRESS, cardMappings );
		const handler = new PlayerSpecificGameQueryHandler();
		const query = new PlayerSpecificGameQuery( mockAggregatedGameData, mockAuthInfo.id );

		const result = await handler.execute( query );
		const tempArr = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ];
		expect( result ).toEqual(
			expect.objectContaining( {
				id: "1",
				myTeam: { ...mockTeamA, members: [ mockPlayer1.id, mockPlayer3.id ] },
				oppositeTeam: { ...mockTeamB, members: [ mockPlayer2.id, mockPlayer4.id ] },
				hand: tempArr.map( i => deck[ i * 4 ] ),
				cardCounts: {
					"1": 12,
					"2": 12,
					"3": 12,
					"4": 12
				}
			} )
		);
	} );
} );