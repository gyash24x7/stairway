import { dictionary } from "@/core/wordle/dictionary";
import type { CreateGameInput, GameData } from "@/core/wordle/schema";
import { getGuessBlocks } from "@/core/wordle/utils";
import { generateId } from "@/utils/generator";
import { createLogger } from "@/utils/logger";
import { produce } from "immer";

const logger = createLogger( "Wordle:Engine" );

/**
 * Creates a new Wordle game with the specified parameters.
 * This function generates a random set of words based on the provided word count and length,
 * and initializes the game state with the player's ID and the generated words.
 * Defaults to 2 words of length 5 if not specified.
 *
 * @param {CreateGameInput} input - The input parameters containing word count, word length and gameId
 * @param {string} playerId - The ID of the player creating the game.
 * @returns {GameData} - The initialized game data.
 */
function createGame( input: CreateGameInput, playerId: string ): GameData {
	logger.debug( ">> createGame()" );

	const { wordCount = 2, wordLength = 5 } = input;
	const words: string[] = [];
	for ( let i = 0; i < wordCount; i++ ) {
		words.push( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
	}

	const game: GameData = {
		id: input.gameId ?? generateId(),
		playerId,
		wordLength,
		wordCount,
		words,
		guesses: [],
		guessBlocks: [],
		completedWords: [],
		completed: false
	};

	game.guessBlocks = getGuessBlocks( game );

	logger.debug( "<< createGame()" );
	return game;
}

/**
 * Adds a guess to the game.
 * This function updates the game state by adding the guessed word to the list of guesses
 * and marking the word as completed if it is part of the game's words.
 *
 * @param {string} guess - The guess made by the player.
 * @param {GameData} data - The current game data.
 * @returns {GameData} - The updated game data with the new guess added.
 */
function makeGuess( guess: string, data: GameData ): GameData {
	return produce( data, draft => {
		logger.debug( ">> makeGuess()" );

		if ( !draft.completedWords.includes( guess ) && draft.words.includes( guess ) ) {
			draft.completedWords.push( guess );
		}

		draft.guesses.push( guess );
		draft.guessBlocks = getGuessBlocks( draft );
		const allWordsGuessed = draft.words.every( word => draft.completedWords.includes( word ) );
		const maxGuessesReached = draft.guesses.length >= ( draft.wordCount + draft.wordLength );

		if ( allWordsGuessed || maxGuessesReached ) {
			draft.completed = true;
		}

		logger.debug( "<< makeGuess()" );
	} );
}

export const engine = { createGame, makeGuess };