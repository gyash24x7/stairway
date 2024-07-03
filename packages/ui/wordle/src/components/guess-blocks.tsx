import type { LetterState, PositionData } from "@common/words";
import { Box, Center, HStack, Text } from "@gluestack-ui/themed";
import { useGameGuesses, useIsValidGuessLength, useIsValidWord } from "../store";

function getBlockColor( state: LetterState ) {
	switch ( state ) {
		case "correct":
			return "$green500";
		case "empty":
			return "$white";
		case "wrong":
			return "$trueGray500";
		case "wrongPlace":
			return "$amber500";
	}
}

export function GuessBlocks( props: { guessBlocks: PositionData[][] } ) {
	const isValidWord = useIsValidWord();
	const isValidGuessLength = useIsValidGuessLength();
	const guesses = useGameGuesses();

	return props.guessBlocks.map( ( guessBlock, i ) => (
		<HStack gap={ "$1" } key={ i }>
			{ guessBlock.map( ( { letter, state }, index ) => (
				<Center
					key={ index }
					backgroundColor={ getBlockColor( state ) }
					borderColor={ isValidGuessLength && !isValidWord && i === guesses.length
						? "$red200"
						: "$borderDark100" }
					w={ "$8" }
					h={ "$8" }
					borderWidth={ 2 }
					borderRadius={ "$sm" }
				>
					<Text size={ "2xl" }>{ letter?.toUpperCase() }</Text>
				</Center>
			) ) }
		</HStack>
	) );
}

export function GuessDiagramBlocks( props: { guessBlocks: PositionData[][] } ) {
	return props.guessBlocks.map( ( guessBlock, i ) => (
		<HStack gap={ "$1" } key={ i }>
			{ guessBlock.map( ( { state }, index ) => (
				<Box
					key={ index }
					backgroundColor={ getBlockColor( state ) }
					borderColor={ "$borderDark100" }
					w={ "$6" }
					h={ "$6" }
					borderWidth={ 1 }
					borderRadius={ "$sm" }
				/>
			) ) }
		</HStack>
	) );
}
