import { AppShell, Flex, Group, Title } from "@mantine/core";
import { AppFooter, AppHeader, ApplicationCard, AppMain } from "../components";

export function HomePage() {
	return (
		<AppShell>
			<AppHeader/>
			<AppMain>
				<Flex gap={ 10 } p={ 10 }>
					<ApplicationCard category={ "Games" } name={ "Literature" } path={ "/literature" }/>
				</Flex>
			</AppMain>
			<AppFooter>
				<Group wrap={ "nowrap" }>
					<img src={ "logo.png" } width={ 72 } height={ 72 } alt={ "literature" }/>
					<Title order={ 1 } my={ 20 } c={ "white" }>STAIRWAY</Title>
				</Group>
			</AppFooter>
		</AppShell>
	);
}