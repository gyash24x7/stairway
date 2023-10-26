import { AuthStoreProvider, LoginPage, SignUpPage } from "@auth/ui";
import { GamePage, GameStoreProvider, HomePage as LiteratureHomePage } from "@literature/ui";
import { Outlet, Route, Routes } from "react-router-dom";
import { HomePage } from "../components";
import { AuthGateway } from "./auth-gateway";

export function AppRoutes() {
	return (
		<Routes>
			<Route path={ "/" } element={ <AuthStoreProvider><Outlet/></AuthStoreProvider> }>
				<Route path={ "literature" } element={ <AuthGateway isPrivate><Outlet/></AuthGateway> }>
					<Route path={ "" } element={ <LiteratureHomePage/> }/>
					<Route path={ ":gameId" } element={ <GameStoreProvider><GamePage/></GameStoreProvider> }/>
				</Route>
				<Route path={ "auth" } element={ <AuthGateway><Outlet/></AuthGateway> }>
					<Route path={ "login" } element={ <LoginPage/> }/>
					<Route path={ "signup" } element={ <SignUpPage/> }/>
				</Route>
				<Route path={ "" } element={ <AuthGateway isPrivate><HomePage/></AuthGateway> }/>
			</Route>
		</Routes>
	);
}