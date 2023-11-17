import { DisplayAuthInfo, useIsLoggedIn } from "@auth/ui";
import { GameActions, GameCode, GamePageContent, GameProvider, gameStoreLoader } from "@literature/ui";
import { AppShell } from "@mantine/core";
import { AppFooter, AppHeader, AppMain, ErrorPage } from "@s2h/ui";
import { Navigate, RouteObject } from "react-router-dom";

export function LiteratureGamePage() {
	const isLoggedIn = useIsLoggedIn();

	if ( !isLoggedIn ) {
		return <Navigate to={ "/" }/>;
	}

	return (
		<GameProvider>
			<AppShell>
				<AppHeader>
					<DisplayAuthInfo/>
				</AppHeader>
				<AppMain>
					<GamePageContent/>
				</AppMain>
				<AppFooter>
					<GameCode/>
					<GameActions/>
				</AppFooter>
			</AppShell>
		</GameProvider>
	);
}

export const literatureGameRoute: RouteObject = {
	path: ":gameId",
	element: <LiteratureGamePage/>,
	errorElement: <ErrorPage/>,
	loader: gameStoreLoader
};