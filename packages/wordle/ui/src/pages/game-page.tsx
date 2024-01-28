import { AppFooter, AppMain } from "@common/ui";
import { Box, Flex, Grid, Text, Title } from "@mantine/core";
import { Fragment } from "react";
import { CreateGame, GameCompleted, GameDescription } from "../components";
import { GameInProgress } from "../components/game-in-progress";
import { Keyboard } from "../components/keyboard";
import { useIsGameCompleted } from "../store";

export function GamePage() {
	const isGameCompleted = useIsGameCompleted();

	return (
		<Fragment>
			<AppMain>
				<Grid p={ 10 } gutter={ 10 } justify={ "center" }>
					<Grid.Col span={ 12 }>
						<GameDescription/>
					</Grid.Col>
					{ isGameCompleted ? <GameCompleted/> : <GameInProgress/> }
				</Grid>
			</AppMain>
			<AppFooter>
				<Box c={ "white" }>
					<Text fz={ 14 } fw={ 700 } lh={ 1 }>GAMES</Text>
					<Title fz={ 56 } lh={ 1 }>WORDLE</Title>
				</Box>
				{ isGameCompleted
					? (
						<Flex gap={ "xl" } align={ "center" }>
							<Text ta={ "right" } style={ { flex: 1 } } fw={ 700 } fz={ 20 }>
								TRY AGAIN?
							</Text>
							<CreateGame/>
						</Flex>
					)
					: <Keyboard/> }
			</AppFooter>
		</Fragment>
	);
}
