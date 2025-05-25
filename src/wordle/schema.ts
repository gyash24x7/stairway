import { generateId } from "@/shared/utils/generator";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const games = sqliteTable( "wdl_games", {
	id: text( "id" ).primaryKey().$default( () => generateId() ),
	playerId: text( "player_id" ).notNull(),
	wordLength: int( "word_length" ).default( 5 ).notNull(),
	wordCount: int( "word_count" ).default( 1 ).notNull(),
	words: text( "words" ).notNull().default( "" ),
	guesses: text( "guesses" ).notNull().default( "" ),
	completedWords: text( "completed_words" ).notNull().default( "" )
} );