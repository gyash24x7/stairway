import { Center, Divider, Heading, VStack } from "@gluestack-ui/themed";
import { GameCompleted, GameInProgress, useIsGameCompleted, WordleContextProvider } from "@wordle/ui";
import React from "react";

export default function LiteratureGameScreen() {
	const isGameCompleted = useIsGameCompleted();
	return (
		<WordleContextProvider>
			<VStack width={ "100%" } justifyContent={ "center" } p={ "$5" } mb={ "$20" }>
				<Center>
					<Heading size={ "3xl" } fontFamily={ "fjalla" }>WORDLE</Heading>
				</Center>
				<Divider my={ "$5" }/>
				<VStack justifyContent={ "space-between" } mb={ "$20" } gap={ "$3" }>
					{ isGameCompleted ? <GameCompleted/> : <GameInProgress/> }
				</VStack>
			</VStack>
		</WordleContextProvider>
	);
}
