import { Box, HStack, VStack } from "@gluestack-ui/themed";
import React, { Fragment } from "react";
import { useGameWords, useGuessBlockMap } from "../store";
import { GuessBlocks } from "./guess-blocks";
import { Keyboard } from "./keyboard";

export function GameInProgress() {
	const words = useGameWords();
	const guessBlockMap = useGuessBlockMap();
	return (
		<Fragment>
			<HStack gap={ "$3" } justifyContent={ "center" } flexWrap={ "wrap" }>
				{ words.map( word => (
					<VStack gap={ "$1" } justifyContent={ "center" } alignItems={ "center" } key={ word }>
						<GuessBlocks guessBlocks={ guessBlockMap[ word ] }/>
					</VStack>
				) ) }
			</HStack>
			<Box p={ "$5" }>
				<Keyboard/>
			</Box>
		</Fragment>
	);
}