import { AppShell, Container, Flex } from "@mantine/core";
import type { ReactNode } from "react";
import { layoutClassnames as classnames } from "../styles/index.js";
import { Logo } from "./logo.js";
import { NavTabs } from "./nav-tabs.js";

export function AppHeader( props: { children: ReactNode } ) {
	return (
		<AppShell.Header className={ classnames.header }>
			<Container size={ "md" } className={ classnames.navContainer }>
				<Flex justify={ "space-between" } align={ "center" }>
					<Logo/>
					{ props.children }
				</Flex>
				<NavTabs/>
			</Container>
		</AppShell.Header>
	);
}