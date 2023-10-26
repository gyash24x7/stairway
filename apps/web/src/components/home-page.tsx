import { Navbar } from "@auth/ui";
import { Box, Flex } from "@mantine/core";
import { ApplicationCard } from "@s2h/ui";

export function HomePage() {
	return (
		<Box p={ "xl" }>
			<Navbar/>
			<Flex gap={ "lg" } mt={ "lg" }>
				<ApplicationCard category={ "Games" } name={ "Literature" } path={ "/literature" }/>
				<ApplicationCard category={ "Games" } name={ "Callbreak" } path={ "/callbreak" }/>
			</Flex>
		</Box>
	);
}