import { generateId } from "@/utils/generator";
import { createLogger } from "@/utils/logger";
import { dictionary } from "@/workers/wordle/dictionary";
import type {
	CreateGameInput,
	GameData,
	MakeGuessInput,
	PlayerGameInfo,
	PositionData,
	SaveFn
} from "@/workers/wordle/types";

/**
 * @class WordleEngine
 * WordleEngine class encapsulates the core logic of the Wordle game.
 * It manages game state, processes player guesses, and calculates letter positions.
 * It provides methods to create a new game, retrieve game data, and make guesses.
 * The engine ensures that the game rules are enforced and maintains the integrity of the game state.
 */
export class WordleEngine {

	private readonly logger = createLogger( "Wordle:Engine" );
	private readonly data: GameData;
	private readonly save: SaveFn;

	/**
	 * Initializes a new instance of the WordleEngine with the provided game data.
	 * It sets up the initial game state and prepares the guess blocks based on the current guesses.
	 *
	 * @constructor
	 * @param {GameData} data - The initial game data to set up the engine.
	 * @param {SaveFn} saveFn - A function to save the game data, typically to a database or storage.
	 */
	constructor( data: GameData, saveFn: SaveFn ) {
		this.data = data;
		this.save = saveFn;
		this.updateGuessBlocks();
	}

	/**
	 * Creates a new Wordle game with the specified parameters.
	 * This function generates a random set of words based on the provided word count and length,
	 * and initializes the game state with the player's ID and the generated words.
	 * Defaults to 2 words of length 5 if not specified.
	 *
	 * @param {CreateGameInput} input - The input parameters containing word count, word length and gameId
	 * @param {string} playerId - The ID of the player creating the game.
	 * @param {SaveFn} saveFn - A function to save the game data, typically to a database or storage.
	 * @return {WordleEngine} - A new instance of the WordleEngine initialized with the created game data.
	 */
	public static create( input: CreateGameInput, playerId: string, saveFn: SaveFn ): WordleEngine {
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

		return new WordleEngine( game, saveFn );
	}

	/**
	 * Retrieves the player-specific game information.
	 * This function returns the game state excluding the words to prevent cheating.
	 *
	 * @return {PlayerGameInfo} - The player-specific game information.
	 */
	public getPlayerData(): PlayerGameInfo {
		const { words, ...rest } = this.data;
		return rest;
	}

	/**
	 * Retrieves the list of words for the game.
	 * This function validates if the game is completed before returning the words.
	 * If the game is not completed, it throws an error to prevent cheating.
	 *
	 * @throws {Error} throw an error if the game is not completed.
	 * @return {string[]} - The list of words for the game.
	 */
	public getWords(): string[] {
		this.validateGetWords();
		return this.data.words;
	}

	/**
	 * Processes a player's guess and updates the game state accordingly.
	 * This function validates the guess, checks if it is correct, and updates the list of guesses and completed words.
	 * It also checks if the game is completed based on the number of correct guesses or maximum allowed guesses.
	 * Finally, it updates the guess blocks to reflect the current state of the game.
	 *
	 * @param {string} guess - The guess made by the player.
	 */
	public makeGuess( guess: string ) {
		this.logger.debug( ">> makeGuess()" );

		this.validateMakeGuess( { gameId: this.data.id, guess } );

		if ( !this.data.completedWords.includes( guess ) && this.data.words.includes( guess ) ) {
			this.data.completedWords.push( guess );
		}

		this.data.guesses.push( guess );
		const allWordsGuessed = this.data.words.every( word => this.data.completedWords.includes( word ) );
		const maxGuessesReached = this.data.guesses.length >= ( this.data.wordCount + this.data.wordLength );

		if ( allWordsGuessed || maxGuessesReached ) {
			this.data.completed = true;
		}

		this.updateGuessBlocks();

		this.logger.debug( "<< makeGuess()" );
	}

	/**
	 * Saves the current game data using the provided save function.
	 * This function is typically called after making a guess to persist the updated game state.
	 */
	public async saveGameData() {
		await this.save( this.data );
	}

	/**
	 * Validates if the game is completed before allowing access to the words.
	 * Throws an error if the game is not yet completed.
	 *
	 * @private
	 * @throws {Error} throw an error if the game is not completed.
	 */
	private validateGetWords() {
		this.logger.debug( ">> validateGetWords()" );

		if ( !this.data.completed ) {
			this.logger.error( "Cannot show words before completion! GameId: %s", this.data.id );
			throw "Cannot show words before completion!";
		}

		this.logger.debug( "<< validateGetWords()" );
	}

	/**
	 * Validates the player's guess before processing it.
	 * Ensures that the guess is a valid word and that the player has remaining guesses.
	 * Throws an error if the guess is invalid or if no guesses are left.
	 *
	 * @private
	 * @param input {MakeGuessInput} input - The input containing the player's guess.
	 * @throws {Error} throw an error if the guess is invalid or if no guesses are left.
	 */
	private validateMakeGuess( input: MakeGuessInput ) {
		this.logger.debug( ">> validateMakeGuess()" );

		if ( this.data.guesses.length >= this.data.wordLength + this.data.wordCount ) {
			this.logger.error( "No More Guesses Left! GameId: %s", this.data.id );
			throw "No more guesses left";
		}

		if ( !dictionary.includes( input.guess ) ) {
			this.logger.error( "The guess is not a valid word! GameId: %s", this.data.id );
			throw "The guess is not a valid word";
		}

		this.logger.debug( "<< validateMakeGuess()" );
	}

	/**
	 * Updates the guess blocks based on the current guesses and words.
	 * This function recalculates the positions of letters in each guess block,
	 * marking them as correct, wrong place, or wrong based on the game's words.
	 *
	 * @private
	 */
	private updateGuessBlocks() {
		const { guesses, wordCount, wordLength, words } = this.data;
		this.data.guessBlocks = words.map( word => {
			const completedIndex = guesses.indexOf( word );
			return new Array( wordLength + wordCount ).fill( 0 ).map( ( _, i ) => i < guesses.length
				? this.calculatePositions( word, guesses[ i ], completedIndex !== -1 && i > completedIndex )
				: new Array( wordLength ).fill( 0 )
					.map( ( _, index ) => ( { letter: "", state: "empty", index } ) ) );
		} );
	}

	/**
	 * Calculates the positions of letters in a word based on the input string.
	 * It determines if each letter is correct, in the wrong place, or wrong,
	 * and returns an array of position data for each letter in the input.
	 * If the word has already been guessed correctly, it marks all positions as empty.
	 *
	 * @private
	 * @param {string} word - The target word to compare against.
	 * @param {string} input - The player's input string.
	 * @param {boolean} isCompleted - Indicates if the word has already been guessed correctly.
	 * @returns {PositionData[]} - An array of position data for each letter in the input.
	 */
	private calculatePositions( word: string, input: string, isCompleted: boolean = false ): PositionData[] {
		const correctLetters = word.toLowerCase().split( "" );
		const inputLetters = input.toLowerCase().split( "" );

		if ( isCompleted ) {
			return inputLetters.map( ( _, index ) => ( { letter: "", state: "empty", index } ) );
		}

		let remainingCharacters = [ ...correctLetters ];
		return inputLetters.map( ( letter, index ) => {
			let state: PositionData["state"] = "wrong";
			if ( correctLetters[ index ] === letter ) {
				state = "correct";
				remainingCharacters.splice( remainingCharacters.indexOf( letter ), 1 );
			} else if ( remainingCharacters.includes( letter ) ) {
				state = "wrongPlace";
				remainingCharacters.splice( remainingCharacters.indexOf( letter ), 1 );
			}
			return { letter, state, index };
		} );
	}
}