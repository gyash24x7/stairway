import { AppShell, Container, Flex } from "@mantine/core";
import type { ReactNode } from "react";
import { layoutClassnames as classnames } from "../styles";
import { Logo } from "./logo";
import { NavTabs } from "./nav-tabs";

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