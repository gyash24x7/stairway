import { Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, LoginPage, SignUpPage } from "@auth/ui";
import { NotAuthenticatedPage } from "./not-authentucated";
import { AuthenticatedPage } from "./authenticated";
import { GameProvider, HomePage as LiteratureHomePage } from "@literature/ui";

export function AppRoutes() {
	return (
		<Routes>
			<Route path={ "/" } element={ <AuthProvider><Outlet/></AuthProvider> }>
				<Route path={ "literature" } element={ <AuthenticatedPage><Outlet/></AuthenticatedPage> }>
					<Route path={ "" } element={ <LiteratureHomePage/> }/>
					<Route path={ ":gameId" } element={ <GameProvider><Outlet/></GameProvider> }/>
				</Route>
				<Route path={ "auth" } element={ <NotAuthenticatedPage><Outlet/></NotAuthenticatedPage> }>
					<Route path={ "login" } element={ <LoginPage/> }/>
					<Route path={ "signup" } element={ <SignUpPage/> }/>
				</Route>
			</Route>
		</Routes>
	);
}