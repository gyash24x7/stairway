import type { Router as WordleRouter } from "@backend/wordle";
import { calculatePositions, dictionary, getAvailableLetters, type PositionData } from "@common/words";
import { trpcLink } from "@shared/ui";
import { createTRPCReact } from "@trpc/react-query";
import { useWordleStore } from "./store";

// Game State Hooks
export const useGameWords = () => useWordleStore( state => state.gameData.words );
export const useGameGuesses = () => useWordleStore( state => state.gameData.guesses );
export const useIsGameCompleted = () => useWordleStore( state => {
	const areAllWordsCompleted = state.gameData.words.length === state.gameData.completedWords.length;
	const areAllGuessesCompleted = state.gameData.guesses.length ===
		state.gameData.words.length + state.gameData.wordLength;
	return areAllGuessesCompleted || areAllWordsCompleted;
} );

export const useAvailableLetters = () => useWordleStore( state => getAvailableLetters( state.gameData.guesses ) );

export const useGuessBlockMap = () => useWordleStore( ( { gameData, currentGuess } ) => {
	const map: Record<string, PositionData[][]> = {};
	gameData.words.forEach( word => {
		const completedIndex = gameData.guesses.indexOf( word );
		map[ word ] = new Array( gameData.wordLength + gameData.wordCount ).fill( 0 ).map(
			( _, i ) => i < gameData.guesses.length
				? calculatePositions( word, gameData.guesses[ i ] )
				: new Array( gameData.wordLength ).fill( 0 ).map( ( _, index ) => {
					if ( completedIndex > -1 ) {
						return { letter: "", state: "empty", index };
					}

					if ( i === gameData.guesses.length ) {
						return { letter: currentGuess[ index ], state: "empty", index };
					}

					return { letter: "", state: "empty", index };
				} )
		);
	} );
	return map;
} );

export const useGameId = () => useWordleStore( state => state.gameData.id );
export const useCurrentGuess = () => useWordleStore( state => state.currentGuess );
export const useBackspaceCurrentGuess = () => useWordleStore( state => state.backspaceCurrentGuess );
export const useResetCurrentGuess = () => useWordleStore( state => state.resetCurrentGuess );
export const useUpdateCurrentGuess = () => useWordleStore( state => state.updateCurrentGuess );
export const useIsValidWord = () => useWordleStore( state => dictionary.includes( state.currentGuess.join( "" ) ) );
export const useIsValidGuessLength = () => useWordleStore(
	state => state.currentGuess.length === state.gameData.wordLength
);
export const useUpdateGameData = () => useWordleStore( state => state.updateGameData );

export const WordleTrpc = createTRPCReact<WordleRouter>();
export const wordleTrpcClient = WordleTrpc.createClient( { links: [ trpcLink( "wordle" ) ] } );

export const useGetGameQuery = ( gameId: string ) => WordleTrpc.getGame.useQuery( { gameId } );
export const useCreateGameAction = WordleTrpc.createGame.useMutation;
export const useMakeGuessMutation = WordleTrpc.makeGuess.useMutation;