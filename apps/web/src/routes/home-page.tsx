import { AppShell, Flex, Group, Title } from "@mantine/core";
import { AppFooter, AppHeader, ApplicationCard, AppMain, ErrorPage } from "@s2h/ui";
import type { IndexRouteObject } from "react-router-dom";
import { DisplayAuthUser } from "../components/display-auth-user";

export function HomePage() {
	return (
		<AppShell>
			<AppHeader>
				<DisplayAuthUser/>
			</AppHeader>
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

export const homeRoute: IndexRouteObject = {
	index: true,
	element: <HomePage/>,
	errorElement: <ErrorPage/>
};