import { Card } from "@common/ui";
import { Grid, Stack } from "@mantine/core";
import { useGameData, useGuessBlockMap } from "../store";
import { GuessBlocks } from "./guess-block";

export function GameInProgress() {
	const { words } = useGameData();
	const guessBlockMap = useGuessBlockMap();

	return words.map( word => (
		<Grid.Col span={ { xs: 12, sm: 6, xl: 3 } } key={ word }>
			<Card key={ word }>
				<Stack gap={ "sm" } justify={ "center" } align={ "center" } w={ "100%" } h={ "100%" }>
					<GuessBlocks guessBlocks={ guessBlockMap[ word ] }/>
				</Stack>
			</Card>
		</Grid.Col>
	) );
}