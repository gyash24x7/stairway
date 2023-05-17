import { createId as cuid } from "@paralleldrive/cuid2";
import { CardHand } from "@s2h/cards";
import { EnhancedLitPlayer, EnhancedLitTeam } from "@s2h/literature/utils";
import { describe, expect, it } from "vitest";

describe( "Enhanced Lit Team", function () {

	const gameId = cuid();

	const litTeam: LitTeam = { id: cuid(), name: "Team Name", score: 0, gameId };

	const players: LitPlayer[] = [
		{
			id: cuid(),
			name: "Player 1",
			hand: { cards: [ { rank: "Two", suit: "Diamonds" }, { rank: "Two", suit: "Clubs" } ] },
			avatar: "avatar_url",
			gameId,
			teamId: litTeam.id,
			userId: cuid()
		},
		{
			id: cuid(),
			name: "Player 2",
			hand: { cards: [ { rank: "Four", suit: "Diamonds" }, { rank: "Five", suit: "Clubs" } ] },
			avatar: "avatar_url",
			gameId,
			teamId: litTeam.id,
			userId: cuid()
		}
	];

	it( "should serialize and deserialize correctly", function () {
		const enhancedPlayers = players.map( EnhancedLitPlayer.from );
		const enhancedTeam = EnhancedLitTeam.from( litTeam );
		enhancedTeam.addMembers( enhancedPlayers );
		const serializedTeam = JSON.parse( JSON.stringify( enhancedTeam ) );

		expect( serializedTeam[ "id" ] ).toBe( litTeam.id );
		expect( serializedTeam[ "members" ] ).toEqual( enhancedPlayers );
		expect( serializedTeam[ "membersWithCards" ] ).toBeUndefined();

		const deserializedTeam = new EnhancedLitTeam( serializedTeam );

		expect( deserializedTeam.id ).toBe( serializedTeam.id );
		expect( deserializedTeam.members.length ).toBe( 2 );

		deserializedTeam.members[ 0 ].hand = CardHand.from( { cards: [] } );
		expect( deserializedTeam.membersWithCards.length ).toEqual( 1 );
	} );
} );