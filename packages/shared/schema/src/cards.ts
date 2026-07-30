import * as Schema from "effect/Schema";

export type CardRank = typeof CardRank.Type;
export const CardRank = Schema.Literals( [
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K"
] );

export type CardSuit = typeof CardSuit.Type;
export const CardSuit = Schema.Literals( [ "H", "C", "S", "D" ] );

export type CardId = typeof CardId.Type;
export const CardId = Schema.TemplateLiteral( [ CardRank, CardSuit ] );
