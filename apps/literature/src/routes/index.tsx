import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "../utils/auth";
import HomePage from "../pages/home";
import PlayPage from "../pages/play";
import { GameProvider } from "../utils/game-context";

export function AppRoutes() {
	const { user } = useAuth();

	return (
		<BrowserRouter>
			<Routes>
				<Route path = { "/" } element = { <HomePage/> }/>
				<Route path = { "play" } element = { <Outlet/> }>
					{ !!user && <Route path = { ":gameId" } element = { <GameProvider><PlayPage/></GameProvider> }/> }
					<Route index element = { <Navigate to = { "/" }/> }/>
				</Route>
				<Route path = { "*" } element = { <Navigate to = { "/" }/> }/>
			</Routes>
		</BrowserRouter>
	);
}