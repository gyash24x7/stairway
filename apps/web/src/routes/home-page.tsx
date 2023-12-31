import { AppFooter, AppHeader, ApplicationCard, AppMain, ErrorPage, Logo } from "@common/ui";
import { AppShell, Flex, Group } from "@mantine/core";
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
					<Logo/>
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