import { createId as cuid } from "@paralleldrive/cuid2";
import { ILiteratureTeam, LiteratureTeam } from "@s2h/literature/utils";
import { describe, expect, it } from "vitest";

describe( "Literature Team", () => {

	const gameId = cuid();
	const literatureTeam: ILiteratureTeam = { name: "Team Name", score: 0, gameId, members: [ cuid(), cuid() ] };

	it( "should serialize and deserialize correctly", () => {
		const team = LiteratureTeam.from( literatureTeam );
		const serializedTeam = team.serialize();

		expect( serializedTeam[ "name" ] ).toBe( literatureTeam.name );
		expect( serializedTeam[ "members" ] ).toEqual( literatureTeam.members );

		const deserializedTeam = LiteratureTeam.from( serializedTeam );

		expect( deserializedTeam.name ).toBe( serializedTeam.name );
		expect( deserializedTeam.members.length ).toBe( 2 );
	} );
} );