import { CardRank, CardSet, CardSuit, PlayingCard } from "@s2h/cards";
import { ILiteraturePlayer, LiteraturePlayer } from "@s2h/literature/utils";
import { describe, expect, it } from "vitest";
import { IUser } from "@s2h/utils";
import { createId } from "@paralleldrive/cuid2";

describe( "Literature Player", () => {

	const literaturePlayer: ILiteraturePlayer = {
		id: createId(),
		name: "Player Name",
		hand: {
			cards: [
				{ rank: CardRank.TWO, suit: CardSuit.DIAMONDS },
				{ rank: CardRank.TWO, suit: CardSuit.CLUBS }
			]
		},
		avatar: "avatar_url",
		team: "some_team"
	};

	const user: IUser = {
		id: literaturePlayer.id,
		name: literaturePlayer.name,
		avatar: literaturePlayer.avatar,
		salt: "",
		email: ""
	};

	it( "should serialize and deserialize correctly", () => {
		const player = LiteraturePlayer.from( literaturePlayer );
		const serializedPlayer = player.serialize();

		expect( serializedPlayer.id ).toBe( literaturePlayer.id );
		expect( serializedPlayer.hand ).toEqual( literaturePlayer.hand );

		const deserializedPlayer = LiteraturePlayer.from( serializedPlayer );
		const twoOfDiamonds = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.DIAMONDS } );
		const twoOfClubs = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.CLUBS } );

		expect( deserializedPlayer.id ).toBe( serializedPlayer.id );
		expect( deserializedPlayer.hand.containsAll( [ twoOfClubs, twoOfDiamonds ] ) ).toBeTruthy();
		expect( deserializedPlayer.callableCardSets ).toContain( CardSet.SMALL_DIAMONDS );
		expect( deserializedPlayer.askableCardSets ).toContain( CardSet.SMALL_CLUBS );
	} );

	it( "should be able to create new players from users", () => {
		const player = LiteraturePlayer.create( user );

		expect( player.id ).toBe( user.id );
		expect( player.name ).toBe( user.name );
	} );
} );