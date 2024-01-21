import { Box, Button, Flex, Group, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { applicationCardClassnames as classnames } from "../styles/components.css";
import { AppFooter } from "./footer";
import { Logo } from "./logo";
import { AppMain } from "./main";

function LiteratureApplicationCard() {
	return (
		<Flex direction={ "column" } justify={ "space-between" } className={ classnames.card } p={ 30 }>
			<Box>
				<Text fz={ 14 } fw={ 700 } lh={ 1 }>GAMES</Text>
				<Title fz={ 56 } lh={ 1 }>LITERATURE</Title>
			</Box>
			<Box>
				<Link to={ "/literature" }>
					<Button color={ "brand" } fw={ 700 }>
						PLAY
					</Button>
				</Link>
			</Box>
		</Flex>
	);
}

export function HomePage() {
	return (
		<Fragment>
			<AppMain>
				<Flex gap={ 10 } p={ 10 }>
					<LiteratureApplicationCard/>
				</Flex>
			</AppMain>
			<AppFooter>
				<Group wrap={ "nowrap" }>
					<Logo/>
				</Group>
			</AppFooter>
		</Fragment>
	);
}