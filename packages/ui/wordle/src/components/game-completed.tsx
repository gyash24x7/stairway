import { Heading, HStack, VStack } from "@gluestack-ui/themed";
import { useGameWords, useGuessBlockMap } from "../store";
import { CreateGame } from "./create-game";
import { GuessDiagramBlocks } from "./guess-blocks";

export function GameCompleted() {
	const words = useGameWords();
	const guessBlockMap = useGuessBlockMap();

	return (
		<VStack>
			<VStack gap={ "$3" } justifyContent={ "center" } alignItems={ "center" } p={ "$3" }>
				<Heading>Game Completed</Heading>
			</VStack>
			<HStack gap={ "$3" } justifyContent={ "center" }>
				{ words.map( word => (
					<VStack gap={ "$1" } justifyContent={ "center" } alignItems={ "center" } key={ word }>
						<GuessDiagramBlocks guessBlocks={ guessBlockMap[ word ] }/>
						<Heading>{ word.toUpperCase() }</Heading>
					</VStack>
				) ) }
			</HStack>
			<VStack gap={ "$3" } alignItems={ "center" } mt={ "$5" }>
				<Heading>TRY AGAIN?</Heading>
				<CreateGame/>
			</VStack>
		</VStack>
	);
}