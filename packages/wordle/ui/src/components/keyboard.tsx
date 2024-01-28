import { Flex } from "@mantine/core";
import { IconBackspace, IconLogin2 } from "@tabler/icons-react";
import { useMemo } from "react";
import { wordleGameRoute } from "../routes";
import {
	useAvailableLetters,
	useBackspaceCurrentGuess,
	useCurrentGuess,
	useMakeGuessMutation,
	useResetCurrentGuess,
	useUpdateCurrentGuess,
	useUpdateGameData
} from "../store";
import { keyboardClassnames } from "../styles/components.css";

const LINES = [
	[ "q", "w", "e", "r", "t", "y", "u", "i", "o", "p" ],
	[ "a", "s", "d", "f", "g", "h", "j", "k", "l" ],
	[ "enter", "z", "x", "c", "v", "b", "n", "m", "back" ]
];

export function KeyboardKey( { letter }: { letter: string } ) {
	const { gameId } = wordleGameRoute.useParams();
	const currentGuess = useCurrentGuess();
	const updateCurrentGuess = useUpdateCurrentGuess();
	const backspaceCurrentGuess = useBackspaceCurrentGuess();
	const resetCurrentGuess = useResetCurrentGuess();
	const updateGameData = useUpdateGameData();
	const availableLetters = useAvailableLetters();
	const { mutateAsync } = useMakeGuessMutation( { onSuccess: updateGameData } );

	const letterClassname = useMemo(
		() => keyboardClassnames.letterWrapper( {
			available: letter.length !== 1 || availableLetters.includes( letter ),
			isEnter: letter === "enter",
			isBack: letter === "back"
		} ),
		[ availableLetters, letter ]
	);

	const onLetterClick = () => {
		updateCurrentGuess( letter );
	};

	const onBackspaceClick = () => {
		backspaceCurrentGuess();
	};

	const onEnterClick = async () => {
		await mutateAsync( { gameId, guess: currentGuess.join( "" ) } );
		resetCurrentGuess();
	};

	if ( letter === "enter" ) {
		return (
			<Flex className={ letterClassname } onClick={ onEnterClick }>
				<IconLogin2/>
			</Flex>
		);
	}

	if ( letter === "back" ) {
		return (
			<Flex className={ letterClassname } onClick={ onBackspaceClick }>
				<IconBackspace/>
			</Flex>
		);
	}

	return (
		<Flex className={ letterClassname } onClick={ onLetterClick }>
			{ letter.toUpperCase() }
		</Flex>
	);
}

export function Keyboard() {
	return (
		<Flex direction={ "column" } gap={ "xs" } align={ "center" }>
			{ LINES.map( ( line ) => (
				<Flex gap={ "xs" } key={ line.join( "" ) }>
					{ line.map( ( letter ) => <KeyboardKey letter={ letter } key={ letter }/> ) }
				</Flex>
			) ) }
		</Flex>
	);
}