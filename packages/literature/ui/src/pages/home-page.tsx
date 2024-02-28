import { AppFooter, AppMain, useIsLoggedIn } from "@common/ui";
import { Box, Group, Text, Title } from "@mantine/core";
import { Fragment } from "react";
import { CreateGame, HomePageContent, JoinGame } from "../components";

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
					<Title fz={ 56 } lh={ 1 }>LITERATURE</Title>
				</Box>
				<Group>
					{ isLoggedIn
						? (
							<Fragment>
								<CreateGame/>
								<JoinGame/>
							</Fragment>
						)
						: <Title>Login to Play!</Title>
					}
				</Group>
			</AppFooter>
		</Fragment>
	);
}
