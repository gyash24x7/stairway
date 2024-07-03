import { HStack, Pressable, Text, VStack } from "@gluestack-ui/themed";
import { Delete, LogIn } from "lucide-react-native";
import { useMemo } from "react";
import {
	useAvailableLetters,
	useBackspaceCurrentGuess,
	useCurrentGuess,
	useGameId,
	useIsValidWord,
	useMakeGuessMutation,
	useResetCurrentGuess,
	useUpdateCurrentGuess,
	useUpdateGameData
} from "../store";

const LINES = [
	[ "q", "w", "e", "r", "t", "y", "u", "i", "o", "p" ],
	[ "a", "s", "d", "f", "g", "h", "j", "k", "l" ],
	[ "enter", "z", "x", "c", "v", "b", "n", "m", "back" ]
];

export function KeyboardKey( { letter }: { letter: string } ) {
	const gameId = useGameId();
	const currentGuess = useCurrentGuess();
	const updateCurrentGuess = useUpdateCurrentGuess();
	const backspaceCurrentGuess = useBackspaceCurrentGuess();
	const resetCurrentGuess = useResetCurrentGuess();
	const updateGameData = useUpdateGameData();
	const availableLetters = useAvailableLetters();
	const { mutateAsync } = useMakeGuessMutation( { onSuccess: updateGameData } );
	const isValidWord = useIsValidWord();

	const isLetterAvailable = useMemo(
		() => letter.length !== 1 || availableLetters.includes( letter ),
		[ letter, availableLetters ]
	);

	const onLetterClick = () => {
		updateCurrentGuess( letter );
	};

	const onBackspaceClick = () => {
		backspaceCurrentGuess();
	};

	const onEnterClick = async () => {
		if ( isValidWord ) {
			await mutateAsync( { gameId, guess: currentGuess.join( "" ) } );
		}
		resetCurrentGuess();
	};

	if ( letter === "enter" ) {
		return (
			<Pressable
				onPress={ onEnterClick }
				justifyContent={ "center" }
				w={ "$12" }
				h={ "$12" }
				alignItems={ "center" }
				borderRadius={ "$md" }
				backgroundColor={ "$green500" }
			>
				<LogIn/>
			</Pressable>
		);
	}

	if ( letter === "back" ) {
		return (
			<Pressable
				onPress={ onBackspaceClick }
				justifyContent={ "center" }
				w={ "$12" }
				h={ "$12" }
				alignItems={ "center" }
				borderRadius={ "$md" }
				backgroundColor={ "$amber500" }
			>
				<Delete/>
			</Pressable>
		);
	}

	return (
		<Pressable
			onPress={ onLetterClick }
			justifyContent={ "center" }
			w={ "$8" }
			h={ "$12" }
			alignItems={ "center" }
			borderRadius={ "$md" }
			backgroundColor={ isLetterAvailable ? "$trueGray600" : "$trueGray900" }
		>
			<Text color={ "$white" }>{ letter.toUpperCase() }</Text>
		</Pressable>
	);
}

export function Keyboard() {
	return (
		<VStack gap={ "$1" } alignItems={ "center" }>
			{ LINES.map( ( line ) => (
				<HStack gap={ "$1" } key={ line.join( "" ) }>
					{ line.map( ( letter ) => <KeyboardKey letter={ letter } key={ letter }/> ) }
				</HStack>
			) ) }
		</VStack>
	);
}