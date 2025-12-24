import { generateId } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import { DurableObject } from "cloudflare:workers";
import { dictionaries } from "./dictionary.ts";
import type { Bindings, CreateGameInput, GameData, MakeGuessInput, PlayerId, PositionData } from "./types.ts";

/**
 * Durable Object that encapsulates the authoritative Wordle game state and logic.
 *
 * Responsibilities:
 * - Hold the canonical GameData for a single game instance.
 * - Initialize games, accept/validate guesses, compute per-letter feedback,
 *   and persist the GameData to the configured KV namespace.
 *
 * Side effects:
 * - Many methods mutate `this.data`. Persist changes by calling saveGameData()
 *   (most public mutating methods do this internally).
 *
 * Notes:
 * - This class is constructed inside a Durable Object context. State is loaded
 *   during construction using ctx.blockConcurrencyWhile(...) to avoid races.
 *
 * @public
 * @class WordleEngine
 */
export class WordleEngine extends DurableObject<Bindings> {

	protected data: GameData;
	private readonly logger = createLogger( "Wordle:Engine" );
	private readonly key: string;

	constructor( ctx: DurableObjectState, env: Bindings ) {
		super( ctx, env );
		this.key = ctx.id.toString();
		this.data = WordleEngine.defaultGameData();

		ctx.blockConcurrencyWhile( async () => {
			const data = await this.loadGameData();
			if ( data ) {
				this.data = data;
			} else {
				this.logger.info( "No existing game data found, starting new game." );
				await this.saveGameData();
			}
		} );
	}

	/**
	 * Create a new GameData object populated with deterministic defaults.
	 *
	 * Side effects: none (pure factory). Caller is expected to assign the returned
	 * object to this.data and persist it if desired.
	 *
	 * @returns New GameData populated with default values (id, wordLength, wordCount, etc).
	 * @private
	 */
	private static defaultGameData() {
		return {
			id: generateId(),
			playerId: "",
			wordLength: 5 as const,
			wordCount: 2,
			words: [],
			guesses: [],
			guessBlocks: [],
			completedWords: [],
			completed: false
		};
	}

	/**
	 * Initialize or reconfigure a game instance.
	 *
	 * Behaviour / side effects:
	 * - Mutates this.data.playerId, this.data.wordCount, this.data.wordLength.
	 * - Selects `wordCount` random words from the embedded dictionary and sets this.data.words.
	 * - Recomputes guessBlocks and persists the updated GameData to KV.
	 *
	 * Validation: This method assumes the caller provides sensible input (e.g., matching wordLength).
	 * It does not throw; it logs and overwrites current configuration.
	 *
	 * @param input Input object with playerId, optional wordCount and wordLength.
	 * @param playerId ID of the requesting player.
	 * @returns Object with the game ID in `data`.
	 * @public
	 */
	public async initialize( input: CreateGameInput, playerId: PlayerId ) {
		this.logger.debug( ">> initialize()" );

		this.data.playerId = playerId;
		this.data.wordCount = input.wordCount ?? this.data.wordCount;
		this.data.wordLength = input.wordLength ?? this.data.wordLength;

		const dictionary = dictionaries[ this.data.wordLength ];

		const words: string[] = [];
		for ( let i = 0; i < this.data.wordCount; i++ ) {
			words.push( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
		}

		this.data.words = words;
		this.updateGuessBlocks();

		await this.saveGameData();
		await this.saveDurableObjectId();

		this.logger.debug( "<< initialize()" );
		return { data: this.data.id };
	}

	/**
	 * Produce a player-safe snapshot of the game state.
	 * This omits the secret `words` array so the returned object is safe to return to clients.
	 * No state mutation or persistence occurs.
	 *
	 * @param playerId ID of the requesting player.
	 * @returns Player-facing view of the current game data.
	 * @public
	 */
	public async getPlayerData( playerId: PlayerId ) {
		this.logger.debug( ">> getPlayerData()" );

		const { error } = this.validatePlayerPartOfGame( playerId );
		if ( error ) {
			this.logger.error( "Get player data validation failed: %s", error );
			return { error };
		}

		const { words, ...data } = this.data;

		this.logger.debug( "<< getPlayerData()" );
		return { data };
	}

	/**
	 * Return the secret words for the game.
	 * Behaviour:
	 * - Only allowed once the game is completed (this.data.completed === true).
	 * - Does not mutate state.
	 *
	 * @param playerId ID of the requesting player.
	 * @returns Array of target words or an error if not allowed.
	 * @public
	 */
	public async getWords( playerId: PlayerId ) {
		this.logger.debug( ">> getWords()" );

		const { error } = this.validateGetWords( playerId );
		if ( error ) {
			this.logger.error( "Get words validation failed: %s", error );
			return { error };
		}

		return { data: this.data.words };
	}

	/**
	 * Process a player's guess and update game state accordingly.
	 *
	 * Steps:
	 * 1. Validate the guess (remaining guesses and dictionary membership).
	 * 2. Record the guess in this.data.guesses.
	 * 3. If the guess matches any target word(s), mark them in this.data.completedWords.
	 * 4. Flag this.data.completed when all words guessed or max guesses reached.
	 * 5. Recompute guessBlocks and persist the updated GameData.
	 *
	 * Side effects:
	 * - Mutates this.data and persists changes via saveGameData().
	 *
	 * @param input Object with property `guess` (string).
	 * @param playerId ID of the requesting player.
	 * @returns Empty object on success or { error } describing validation failure.
	 * @public
	 */
	public async makeGuess( input: MakeGuessInput, playerId: PlayerId ) {
		this.logger.debug( ">> makeGuess()" );

		const { error } = this.validateMakeGuess( input, playerId );
		if ( error ) {
			this.logger.error( "Guess validation failed: %s", error );
			return { error };
		}

		if ( !this.data.completedWords.includes( input.guess ) && this.data.words.includes( input.guess ) ) {
			this.data.completedWords.push( input.guess );
		}

		this.data.guesses.push( input.guess );
		const allWordsGuessed = this.data.words.every( word => this.data.completedWords.includes( word ) );
		const maxGuessesReached = this.data.guesses.length >= ( this.data.wordCount + this.data.wordLength );

		if ( allWordsGuessed || maxGuessesReached ) {
			this.data.completed = true;
		}

		this.updateGuessBlocks();
		await this.saveGameData();

		const { words, ...data } = this.data;
		this.logger.debug( "<< makeGuess()" );
		return { data };
	}

	/**
	 * Ensure that the requesting player is part of this game.
	 * This method does not mutate state.
	 *
	 * @param playerId ID of the requesting player.
	 * @returns Empty object on success or an error description.
	 * @private
	 */
	private validatePlayerPartOfGame( playerId: PlayerId ) {
		this.logger.debug( ">> validatePlayerPartOfGame()" );

		if ( this.data.playerId !== playerId ) {
			this.logger.error( "Player is not part of this game! GameId: %s, PlayerId: %s", this.data.id, playerId );
			return { error: "Player is not part of this game!" };
		}

		this.logger.debug( "<< validatePlayerPartOfGame()" );
		return {};
	}

	/**
	 * Ensure that the words can be revealed. The only requirement currently is that
	 * the game must be marked completed. This method does not mutate state.
	 *
	 * @param playerId ID of the requesting player.
	 * @returns Empty object on success or an error description.
	 * @private
	 */
	private validateGetWords( playerId: PlayerId ) {
		this.logger.debug( ">> validateGetWords()" );

		const { error } = this.validatePlayerPartOfGame( playerId );
		if ( error ) {
			return { error };
		}

		if ( !this.data.completed ) {
			this.logger.error( "Cannot show words before completion! GameId: %s", this.data.id );
			return { error: "Cannot show words before completion!" };
		}

		this.logger.debug( "<< validateGetWords()" );
		return {};
	}

	/**
	 * Validate a guess before applying it.
	 * This method does not mutate state; callers should abort if an error is returned.
	 *
	 * Checks performed:
	 * - There are remaining allowed guesses: guesses.length < (wordLength + wordCount).
	 * - The guessed word exists in the in-memory dictionary (prevents nonsense words).
	 *
	 * @param input Object with property `guess` (string).
	 * @param playerId ID of the requesting player.
	 * @returns Empty object on success or an error description.
	 * @private
	 */
	private validateMakeGuess( input: MakeGuessInput, playerId: PlayerId ) {
		this.logger.debug( ">> validateMakeGuess()" );

		const dictionary = dictionaries[ this.data.wordLength ];
		const { error } = this.validatePlayerPartOfGame( playerId );
		if ( error ) {
			return { error };
		}

		if ( this.data.guesses.length >= this.data.wordLength + this.data.wordCount ) {
			this.logger.error( "No More Guesses Left! GameId: %s", this.data.id );
			return { error: "No more guesses left" };
		}

		if ( !dictionary.includes( input.guess ) ) {
			this.logger.error( "The guess is not a valid word! GameId: %s", this.data.id );
			return { error: "The guess is not a valid word" };
		}

		this.logger.debug( "<< validateMakeGuess()" );
		return {};
	}

	/**
	 * Recompute the guessBlocks matrix used by clients to render feedback.
	 *
	 * For each target word this produces an array of rows (one row per allowed turn):
	 * - If a guess exists at turn i, compute per-letter PositionData via calculatePositions.
	 * - Otherwise produce an "empty" row filled with PositionData entries where state === "empty".
	 *
	 * Side effects:
	 * - Mutates this.data.guessBlocks but does not persist; callers should call saveGameData().
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
					.map( ( _, index ) => ( { letter: "", state: "empty" as const, index } ) ) );
		} );
	}

	/**
	 * Compute per-letter feedback for a single guess against a single target word.
	 *
	 * Algorithm (two-pass):
	 * - First pass: mark exact matches as "correct" and remove those letters from the pool.
	 * - Second pass: for remaining letters mark as "wrongPlace" if the letter exists in the pool,
	 *   otherwise mark as "wrong".
	 *
	 * Special case:
	 * - If isCompleted is true (the target word was already guessed earlier), returns an empty row
	 *   (each PositionData.state === "empty") for that guess slot.
	 *
	 * @param word The target word to check against (case-insensitive).
	 * @param input The player's guessed word (case-insensitive).
	 * @param [isCompleted=false] If true, produce an "empty" row.
	 * @returns Array of per-letter PositionData objects describing letter and state.
	 * @private
	 */
	private calculatePositions( word: string, input: string, isCompleted: boolean = false ) {
		const correctLetters = word.toLowerCase().split( "" );
		const inputLetters = input.toLowerCase().split( "" );

		if ( isCompleted ) {
			return inputLetters.map( ( _, index ) => ( { letter: "", state: "empty" as const, index } ) );
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

	/**
	 * Load persisted GameData from KV.
	 * @returns Parsed GameData or undefined if not present.
	 * @private
	 */
	private async loadGameData() {
		return this.env.WORDLE_KV.get<GameData>( this.key, "json" );
	}

	/**
	 * Persist the current in-memory GameData to KV.
	 * Side effects:
	 * - Serializes and writes this.data to the configured WORDLE_KV namespace.
	 *
	 * @private
	 */
	private async saveGameData() {
		await this.env.WORDLE_KV.put( this.key, JSON.stringify( this.data ) );
	}

	/**
	 * Persist a mapping from game ID to Durable Object ID in KV.
	 * Side effects:
	 * - Writes a key `gameId:{this.data.id}` with value this.key to WORDLE_KV.
	 *
	 * @private
	 */
	private async saveDurableObjectId() {
		await this.env.WORDLE_KV.put( `gameId:${ this.data.id }`, this.key );
	}
}