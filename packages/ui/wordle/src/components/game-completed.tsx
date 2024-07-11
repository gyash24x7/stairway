import { Heading, HStack, VStack, Center } from "@gluestack-ui/themed";
import { useGameWords, useGuessBlockMap } from "../store";
import { CreateGame } from "./create-game";
import { GuessDiagramBlocks } from "./guess-blocks";
import { Fragment } from "react";

export function GameCompleted() {
	const words = useGameWords();
	const guessBlockMap = useGuessBlockMap();

	return (
		<Fragment>
			<Center>
				<Heading>Game Completed</Heading>
			</Center>
			<HStack gap={ "$3" } justifyContent={ "center" } flexWrap={ "wrap" }>
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
		</Fragment>
	);
}