import { Tabs } from "@mantine/core";
import { clsx } from "clsx";
import { useLocation, useNavigate } from "react-router-dom";
import classnames from "../styles/components.module.css";

export function NavTabs() {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const isLiteratureTabActive = pathname.includes( "literature" );

	const activeTab = isLiteratureTabActive ? "literature" : "home";

	return (
		<Tabs value={ activeTab }>
			<Tabs.List className={ classnames[ "navTabsList" ] }>
				<Tabs.Tab
					value={ "home" }
					onClick={ () => navigate( "/" ) }
					className={ clsx( classnames[ "navTab" ], !isLiteratureTabActive && classnames[ "navTabActive" ] ) }
				>
					Home
				</Tabs.Tab>
				<Tabs.Tab
					value={ "literature" }
					onClick={ () => navigate( "/literature" ) }
					className={ clsx( classnames[ "navTab" ], isLiteratureTabActive && classnames[ "navTabActive" ] ) }
				>
					Literature
				</Tabs.Tab>
			</Tabs.List>
		</Tabs>
	);
}