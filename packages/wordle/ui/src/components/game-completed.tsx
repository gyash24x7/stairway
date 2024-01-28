import { Card } from "@common/ui";
import { Flex, Grid, Stack, Title } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { Fragment } from "react";
import { useGameData, useGuessBlockMap } from "../store";
import { GuessDiagramBlocks } from "./guess-block";

export function GameCompleted() {
	const { words } = useGameData();
	const guessBlockMap = useGuessBlockMap();

	return (
		<Fragment>
			<Grid.Col span={ 4 }>
				<Card stretch>
					<Flex gap={ "xxl" } direction={ "column" } justify={ "center" } align={ "center" } h={ "100%" }>
						<IconCircleCheck width={ "25%" } height={ "25%" }/>
						<Title>Game Completed</Title>
					</Flex>
				</Card>
			</Grid.Col>
			<Grid.Col span={ 8 }>
				<Grid>
					{ words.map( word => (
						<Grid.Col key={ word } span={ { xs: 12, sm: 6, xl: 3 } }>
							<Card stretch>
								<Stack gap={ "sm" } justify={ "center" } align={ "center" } w={ "100%" } h={ "100%" }>
									<GuessDiagramBlocks guessBlocks={ guessBlockMap[ word ] }/>
									<Title order={ 1 }>{ word.toUpperCase() }</Title>
								</Stack>
							</Card>
						</Grid.Col>
					) ) }
				</Grid>
			</Grid.Col>
		</Fragment>
	);
}