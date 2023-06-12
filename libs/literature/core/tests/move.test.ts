import { CardRank, CardSuit, PlayingCard } from "@s2h/cards";
import { ILiteratureMove, LiteratureMove } from "@s2h/literature/utils";
import { describe, expect, it } from "vitest";
import dayjs from "dayjs";
import { createId } from "@paralleldrive/cuid2";

describe( "Literature Move", () => {

	const literatureMove: ILiteratureMove = {
		id: createId(),
		description: "Move Description",
		timestamp: dayjs().toISOString(),
		actionData: {
			action: "ASK",
			description: "Action Description",
			askData: {
				by: createId(),
				from: createId(),
				card: { rank: CardRank.FOUR, suit: CardSuit.SPADES }
			}
		},
		resultData: {
			result: "CARD_TRANSFER",
			success: true,
			description: "Result Description"
		}
	};

	it( "should serialize and deserialize correctly", () => {
		const move = LiteratureMove.from( literatureMove );
		const serializedMove = move.serialize();

		expect( serializedMove.id ).toBe( literatureMove.id );
		expect( serializedMove.actionData.action ).toBe( "ASK" );
		expect( serializedMove.actionData.askData?.card ).toEqual( literatureMove.actionData.askData?.card );

		const deserializedMove = LiteratureMove.from( serializedMove );

		expect( deserializedMove.id ).toBe( serializedMove.id );
		expect( deserializedMove.actionData.askData?.card )
			.toEqual( PlayingCard.from( { rank: CardRank.FOUR, suit: CardSuit.SPADES } ) );
	} );

	it( "should create move from action and result data", () => {
		const { actionData, resultData } = literatureMove;
		const move = LiteratureMove.create( actionData, resultData );

		expect( move.actionData ).toEqual( actionData );
		expect( move.description ).toEqual( `${ actionData.description } -> ${ resultData.description }` );
	} );
} );