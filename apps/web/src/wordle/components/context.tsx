import { orpc } from "@/api/query";
import { dictionaries } from "@/wordle/core/dictionary";
import type { WordleGame } from "@/wordle/core/types";
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

type WordleContextValue = {
	shared: WordleGame["shared"];
	player: WordleGame["player"];
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

type WordleProviderProps = { data: WordleGame; children: ReactNode; }

export function WordleProvider( { data, children }: WordleProviderProps ) {
	const { shared, player } = data;
	const queryClient = useQueryClient();
	const [ currentGuess, setCurrentGuess ] = useState( "" );
	const [ invalidGuess, setInvalidGuess ] = useState( false );
	const [ lastRevealedRow, setLastRevealedRow ] = useState<number | null>( null );
	const prevGuessCountRef = useRef( shared.state.guesses.length );

	const submitGuess = useMutation( orpc.wordle.submitGuess.mutationOptions( {
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: orpc.wordle.getGame.key( { input: { gameId: shared.id } } )
		} )
	} ) );

	useEffect( () => {
		const count = shared.state.guesses.length;
		if ( count > prevGuessCountRef.current ) {
			setLastRevealedRow( count - 1 );
		}
		prevGuessCountRef.current = count;
	}, [ shared.state.guesses.length ] );

	const wordLength = shared.config.wordLength;
	const gameInProgress = shared.status === "IN_PROGRESS";

	const handleSubmit = () => {
		const guess = currentGuess.trim().toLowerCase();
		if ( !guess || guess.length !== wordLength ) {
			return;
		}

		const dictionary = dictionaries[ wordLength ];
		if ( !dictionary.includes( guess ) ) {
			setInvalidGuess( true );
			setTimeout( () => setInvalidGuess( false ), 1500 );
			return;
		}

		setCurrentGuess( "" );
		submitGuess.mutate( { gameId: shared.id, guess } );
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
			shared,
			player,
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
