import { Tabs } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { navTabsClassnames as classnames } from "../styles/components.css";

export function NavTabs() {
	const navigate = useNavigate();
	const [ activeTab, setActiveTab ] = useState<string | null>(
		window.location.pathname === "/" ? "home" : window.location.pathname.split( "/" )[ 1 ]
	);

	return (
		<Tabs value={ activeTab } onChange={ setActiveTab }>
			<Tabs.List className={ classnames.tabsList }>
				<Tabs.Tab
					value={ "home" }
					onClick={ () => navigate( { to: "/" } ) }
					className={ classnames.tab( { isActive: activeTab === "home" } ) }
				>
					Home
				</Tabs.Tab>
				<Tabs.Tab
					value={ "literature" }
					onClick={ () => navigate( { to: "/literature" } ) }
					className={ classnames.tab( { isActive: activeTab === "literature" } ) }
				>
					Literature
				</Tabs.Tab>
				<Tabs.Tab
					value={ "wordle" }
					onClick={ () => navigate( { to: "/wordle" } ) }
					className={ classnames.tab( { isActive: activeTab === "wordle" } ) }
				>
					Wordle
				</Tabs.Tab>
			</Tabs.List>
		</Tabs>
	);
}