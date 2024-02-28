import { AppFooter, AppMain, useIsLoggedIn } from "@common/ui";
import { Box, Group, Text, Title } from "@mantine/core";
import { Fragment } from "react";
import { CreateGame, HomePageContent } from "../components";

export function HomePage() {
	const isLoggedIn = useIsLoggedIn();
	return (
		<Fragment>
			<AppMain>
				<HomePageContent/>
			</AppMain>
			<AppFooter>
				<Box c={ "white" }>
					<Text fz={ 14 } fw={ 700 } lh={ 1 }>GAMES</Text>
					<Title fz={ 56 } lh={ 1 }>WORDLE</Title>
				</Box>
				<Group>
					{ isLoggedIn ? <CreateGame/> : <Title>Login to Play!</Title> }
				</Group>
			</AppFooter>
		</Fragment>
	);
}
