import { Flex, Group, Title } from "@mantine/core";
import { ApplicationCard } from "@s2h/ui";

export function HomePage() {
	return (
		<Flex gap={ 10 } p={ 10 }>
			<ApplicationCard category={ "Games" } name={ "Literature" } path={ "/literature" }/>
		</Flex>
	);
}

export function HomePageFooter() {
	return (
		<Group wrap={ "nowrap" }>
			<img src={ "logo.png" } width={ 72 } height={ 72 } alt={ "literature" }/>
			<Title order={ 1 } my={ 20 } c={ "white" }>STAIRWAY</Title>
		</Group>
	);
}
