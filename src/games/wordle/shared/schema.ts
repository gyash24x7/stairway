import * as Schema from "effect/Schema";

import {
	BaseGameConfig,
	GameSnapshot,
	InitializeInput,
	PlayerId
} from "@/shared/swish/schema.ts";


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


// --- Config / State / Views ------------------------------------------------------

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

export type WordleSharedView = typeof WordleSharedView.Type;
export const WordleSharedView = Schema.Struct( {
	guesses: Schema.Array( Schema.String ),
	maxGuesses: Schema.Number,
	victory: Schema.optional( Schema.Boolean ),
	guessResults: Schema.Array( GuessResultsForWord )
} );

// A player's view carries the public board PLUS its own (required) private slice;
// the table/spectator view carries only the public board. `WordleView` is the
// discriminated union of the two — clients narrow once on `_tag`.
export type WordlePlayerView = typeof WordlePlayerView.Type;
export const WordlePlayerView = Schema.TaggedStruct( "wordle/PlayerView", {
	...WordleSharedView.fields,
	playerId: PlayerId
} );

export type WordleTableView = typeof WordleTableView.Type;
export const WordleTableView = Schema.TaggedStruct( "wordle/TableView", {
	...WordleSharedView.fields
} );

export type WordleView = typeof WordleView.Type;
export const WordleView = Schema.Union( [ WordlePlayerView, WordleTableView ] );

export type WordleSnapshot = typeof WordleSnapshot.Type;
export const WordleSnapshot = GameSnapshot( WordleView, WordleConfig );


// --- Move Inputs ------------------------------------------------------

export type GuessInput = typeof GuessInput.Type;
export const GuessInput = Schema.Struct( { guess: Schema.String } );

export type WordleInitializeInput = typeof WordleInitializeInput.Type;
export const WordleInitializeInput = InitializeInput( WordleConfig );


// --- Domain Events -----------------------------------------------

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
