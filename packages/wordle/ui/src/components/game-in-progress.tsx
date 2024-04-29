import { Grid, Stack } from "@mantine/core";
import { useGameData, useGuessBlockMap } from "../store";
import { GuessBlocks } from "./guess-block";

export function GameInProgress() {
	const { words } = useGameData();
	const guessBlockMap = useGuessBlockMap();

	return words.map( word => (
		<Grid.Col span={ { xs: 12, sm: 6, xl: 3 } } key={ word }>
			<Stack gap={ "sm" } justify={ "center" } align={ "center" } h={ "100%" } bg={ "white" }>
				<GuessBlocks guessBlocks={ guessBlockMap[ word ] }/>
			</Stack>
		</Grid.Col>
	) );
}