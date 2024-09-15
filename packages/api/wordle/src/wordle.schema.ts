import { createId } from "@paralleldrive/cuid2";
import { json, pgSchema, smallint, text } from "drizzle-orm/pg-core";

export const wordleSchema = pgSchema( "wordle" );

export const games = wordleSchema.table( "wdl_games", {
	id: text( "id" ).primaryKey().$default( () => createId() ),
	playerId: text( "player_id" ).notNull(),
	wordLength: smallint( "word_length" ).default( 5 ).notNull(),
	wordCount: smallint( "word_count" ).default( 1 ).notNull(),
	words: json( "words" ).notNull().$type<string[]>(),
	guesses: json( "guesses" ).notNull().$type<string[]>().default( [] ),
	completedWords: json( "completed_words" ).notNull().$type<string[]>().default( [] )
} );

export type Game = typeof games.$inferSelect;