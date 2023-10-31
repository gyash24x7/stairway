import type { ReactNode } from "react";
import { AppShell, Avatar, Container, Flex, Group, Tabs, Title } from "@mantine/core";
import { appLayoutClassnames as classnames } from "../styles";
import { Logout, useAuthInfo } from "@auth/ui";
import { useLocation, useNavigate } from "react-router-dom";

export type AppLayoutProps = {
	children: ReactNode;
	footer?: ReactNode;
}

export function AppLayout( props: AppLayoutProps ) {
	const authInfo = useAuthInfo();
	const navigate = useNavigate();
	const { pathname } = useLocation();

	const activeTab = pathname.includes( "callbreak" )
		? "callbreak"
		: pathname.includes( "literature" )
			? "literature"
			: "home";


	return (
		<AppShell>
			<AppShell.Header className={ classnames.header }>
				<Container size={ "md" } className={ classnames.navContainer }>
					<Flex justify={ "space-between" } align={ "center" }>
						<Group>
							<img src={ "logo.png" } width={ 72 } height={ 72 } alt={ "literature" }/>
							<Title order={ 1 } my={ 20 }>STAIRWAY</Title>
						</Group>
						<Group>
							<Logout/>
							<Avatar src={ authInfo?.avatar } size={ 48 } radius={ "50%" }/>
						</Group>
					</Flex>
					<Tabs value={ activeTab }>
						<Tabs.List className={ classnames.tabsList }>
							<Tabs.Tab
								value={ "home" }
								onClick={ () => navigate( "/" ) }
								className={ classnames.tab( { isActive: activeTab === "home" } ) }
							>
								Home
							</Tabs.Tab>
							<Tabs.Tab
								value={ "literature" }
								onClick={ () => navigate( "/literature" ) }
								className={ classnames.tab( { isActive: activeTab === "literature" } ) }
							>
								Literature
							</Tabs.Tab>
						</Tabs.List>
					</Tabs>
				</Container>
			</AppShell.Header>
			<AppShell.Main className={ classnames.main }>
				{ props.children }
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