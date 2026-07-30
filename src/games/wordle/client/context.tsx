import { useAuth } from "@/auth/client/use-auth";
import { toPlayerInfo } from "@/contract/client";
import type { WordleSnapshot } from "@/games/wordle/shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState
} from "react";
import { submitGuessFn } from "./client";

type WordleContextValue = {
	data: WordleSnapshot;
	currentGuess: string;
	isPending: boolean;
	invalidGuess: boolean;
	lastRevealedRow: number | null;
	handleKeyPress: ( letter: string ) => void;
	handleBackspace: () => void;
	handleSubmit: () => void;
};

const WordleContext = createContext<WordleContextValue | null>( null );

export function useWordle() {
	const ctx = useContext( WordleContext );
	if ( !ctx ) {
		throw new Error( "useWordle must be used within a WordleProvider" );
	}
	return ctx;
}

type WordleProviderProps = { data: WordleSnapshot; gameId: string; children: ReactNode; };

export function WordleProvider( { data, gameId, children }: WordleProviderProps ) {
	const queryClient = useQueryClient();
	const { authInfo } = useAuth();
	const [ currentGuess, setCurrentGuess ] = useState( "" );
	const [ invalidGuess, _setInvalidGuess ] = useState( false );
	const [ lastRevealedRow, setLastRevealedRow ] = useState<number | null>( null );
	const prevGuessCountRef = useRef( data.view.guesses.length );

	const submitGuess = useMutation( {
		mutationFn: ( guess: string ) => submitGuessFn( gameId, toPlayerInfo( authInfo! ), guess ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "wordle", "getState", gameId ]
		} )
	} );

	useEffect( () => {
		const count = data.view.guesses.length;
		if ( count > prevGuessCountRef.current ) {
			setLastRevealedRow( count - 1 );
		}

		prevGuessCountRef.current = count;
	}, [ data.view.guesses.length ] );

	const wordLength = data.config.wordLength;
	const gameInProgress = data.status === "IN_PROGRESS";

	const handleSubmit = () => {
		const guess = currentGuess.trim().toLowerCase();
		if ( !guess || guess.length !== wordLength || !authInfo ) {
			return;
		}

		setCurrentGuess( "" );
		submitGuess.mutate( guess );
	};

	const handleKeyPress = useCallback( ( letter: string ) => {
		setCurrentGuess( prev => prev.length < wordLength ? prev + letter : prev );
	}, [ wordLength ] );

	const handleBackspace = useCallback( () => {
		setCurrentGuess( prev => prev.slice( 0, -1 ) );
	}, [] );

	const handleKeyDown = ( e: KeyboardEvent ) => {
		if ( e.metaKey || e.ctrlKey || e.altKey ) {
			return;
		}

		if ( e.key === "Enter" ) {
			handleSubmit();
		} else if ( e.key === "Backspace" ) {
			handleBackspace();
		} else if ( /^[a-zA-Z]$/.test( e.key ) ) {
			handleKeyPress( e.key.toLowerCase() );
		}
	};

	useEffect( () => {
		if ( !gameInProgress ) {
			return;
		}

		window.addEventListener( "keydown", handleKeyDown );
		return () => window.removeEventListener( "keydown", handleKeyDown );

	}, [ gameInProgress, handleSubmit, handleKeyPress, handleBackspace ] );

	return (
		<WordleContext value={ {
			data,
			currentGuess,
			isPending: submitGuess.isPending,
			invalidGuess,
			lastRevealedRow,
			handleKeyPress,
			handleBackspace,
			handleSubmit
		} }>
			{ children }
		</WordleContext>
	);
}
