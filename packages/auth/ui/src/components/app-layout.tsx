import { AppShell, Container, Flex } from "@mantine/core";
import { Logo, NavTabs } from "@s2h/ui";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsLoggedIn } from "../store";
import { appLayoutClassnames as classnames } from "../styles";
import { DisplayAuthInfo } from "./display-auth-info";

export type PrivateLayoutProps = {
	children: ReactNode;
	footer?: ReactNode;
}

export function AppLayout( props: PrivateLayoutProps ) {
	const isLoggedIn = useIsLoggedIn();

	if ( !isLoggedIn ) {
		return <Navigate to={ "/login" }/>;
	}

	return (
		<AppShell>
			<AppShell.Header className={ classnames.header }>
				<Container size={ "md" } className={ classnames.navContainer }>
					<Flex justify={ "space-between" } align={ "center" }>
						<Logo/>
						<DisplayAuthInfo/>
					</Flex>
					<NavTabs/>
				</Container>
			</AppShell.Header>
			<AppShell.Main>
				<div className={ classnames.main }>
					{ props.children }
				</div>
			</AppShell.Main>
			<AppShell.Footer className={ classnames.footer }>
				<div className={ classnames.inner }>
					<Container>
						{ props.footer }
					</Container>
				</div>
			</AppShell.Footer>
		</AppShell>
	);
}