import { AppShell, Container, Flex } from "@mantine/core";
import { layoutClassnames as classnames } from "../styles/components.css";
import { Logo } from "./logo";
import { NavTabs } from "./nav-tabs";

export function AppHeader() {
	return (
		<AppShell.Header className={ classnames.header }>
			<Container size={ "md" } className={ classnames.navContainer }>
				<Flex justify={ "space-between" } align={ "center" }>
					<Logo/>
				</Flex>
				<NavTabs/>
			</Container>
		</AppShell.Header>
	);
}