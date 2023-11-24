import { Tabs } from "@mantine/core";
import { useLocation, useNavigate } from "react-router-dom";
import { navTabsClassnames as classnames } from "../styles/index.js";

export function NavTabs() {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const isLiteratureTabActive = pathname.includes( "literature" );

	const activeTab = isLiteratureTabActive ? "literature" : "home";

	return (
		<Tabs value={ activeTab }>
			<Tabs.List className={ classnames.tabsList }>
				<Tabs.Tab
					value={ "home" }
					onClick={ () => navigate( "/" ) }
					className={ classnames.tab( { isActive: !isLiteratureTabActive } ) }
				>
					Home
				</Tabs.Tab>
				<Tabs.Tab
					value={ "literature" }
					onClick={ () => navigate( "/literature" ) }
					className={ classnames.tab( { isActive: isLiteratureTabActive } ) }
				>
					Literature
				</Tabs.Tab>
			</Tabs.List>
		</Tabs>
	);
}