import { BaseGameConfig, type BaseGameData, BasePlayerView, GameSnapshot } from "@s2h/swish/schema";
import * as Schema from "effect/Schema";

// --- Schemas ---------------------------------------------------------------

export type LetterStatus = typeof LetterStatus.Type;
export const LetterStatus = Schema.Literals( [ "correct", "present", "absent" ] );

export type GuessResult = typeof GuessResult.Type;
export const GuessResult = Schema.Struct( { letter: Schema.String, status: LetterStatus } );

export type GuessRow = typeof GuessRow.Type;
export const GuessRow = Schema.Array( GuessResult );

export type GuessResultsForWord = typeof GuessResultsForWord.Type;
export const GuessResultsForWord = Schema.Array( GuessRow );

export type WordLength = typeof WordLength.Type;
export const WordLength = Schema.Literals( [ 4, 5, 6 ] );

export type WordleConfig = typeof WordleConfig.Type;
export const WordleConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	wordCount: Schema.Number,
	wordLength: WordLength
} );

export type WordleState = typeof WordleState.Type;
export const WordleState = Schema.Struct( {
	words: Schema.Array( Schema.String ),
	guesses: Schema.Array( Schema.String ),
	guessResults: Schema.Record( Schema.String, GuessResultsForWord ),
	maxGuesses: Schema.Number,
	victory: Schema.optional( Schema.Boolean )
} );

export type WordleMoves = typeof WordleMoves.Type;
export const WordleMoves = Schema.Literals( [ "guess" ] );

export type WordleSharedView = typeof WordleSharedView.Type;
export const WordleSharedView = Schema.Struct( {
	guesses: Schema.Array( Schema.String ),
	maxGuesses: Schema.Number,
	victory: Schema.optional( Schema.Boolean ),
	guessResults: Schema.Array( GuessResultsForWord )
} );

export type WordleSnapshot = typeof WordleSnapshot.Type;
export const WordleSnapshot = GameSnapshot( WordleSharedView, BasePlayerView, WordleConfig );

export type GuessInput = typeof GuessInput.Type;
export const GuessInput = Schema.Struct( { guess: Schema.String } );


// --- Domain events -----------------------------------------------

export type GuessedEvent = typeof GuessedEvent.Type;
export const GuessedEvent = Schema.TaggedStruct( "wordle/evt/Guessed", {
	guess: Schema.String,
	rows: Schema.Array( GuessRow )
} );

export type VictoryDecidedEvent = typeof VictoryDecidedEvent.Type;
export const VictoryDecidedEvent = Schema.TaggedStruct(
	"wordle/evt/VictoryDecided",
	{ victory: Schema.Boolean }
);

export type WordleEvents = typeof WordleEvents.Type;
export const WordleEvents = Schema.Union( [ GuessedEvent, VictoryDecidedEvent ] );

export type WordleData = BaseGameData & {
	config: typeof WordleConfig.Type;
	shared: typeof WordleSharedView.Type;
	player: typeof BasePlayerView.Type;
};
