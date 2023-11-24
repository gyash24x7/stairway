import { AppShell, Container, Flex } from "@mantine/core";
import type { ReactNode } from "react";
import classnames from "../styles/components.module.css";
import { Logo } from "./logo";
import { NavTabs } from "./nav-tabs";

export function AppHeader( props: { children: ReactNode } ) {
	return (
		<AppShell.Header className={ classnames[ "layoutHeader" ] }>
			<Container size={ "md" } className={ classnames[ "layoutNavContainer" ] }>
				<Flex justify={ "space-between" } align={ "center" }>
					<Logo/>
					{ props.children }
				</Flex>
				<NavTabs/>
			</Container>
		</AppShell.Header>
	);
}