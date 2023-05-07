import React from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import HomePage from "../pages/home";
import PlayPage from "../pages/play";
import { AuthProvider } from "../utils/auth";
import { GameProvider } from "../utils/game-context";
import { TrpcProvider } from "../utils/trpc";

export function LiteratureOutlet() {
	return (
		<TrpcProvider>
			<AuthProvider>
				<Outlet/>
			</AuthProvider>
		</TrpcProvider>
	);
}

export function LiteratureApp() {
	return (
		<Routes>
			<Route path={ "literature" } element={ <LiteratureOutlet/> }>
				<Route path={ ":gameId" } element={ <GameProvider><PlayPage/></GameProvider> }/>
				<Route index element={ <HomePage/> }/>
			</Route>
		</Routes>
	);
}