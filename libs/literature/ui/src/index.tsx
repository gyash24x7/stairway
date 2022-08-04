import React from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import { GameProvider } from "./utils/game-context";
import PlayPage from "./pages/play";
import HomePage from "./pages/home";
import { TrpcProvider } from "./utils/trpc";
import { AuthProvider } from "./utils/auth";

export function LiteratureOutlet() {
	return (
		<TrpcProvider>
			<AuthProvider>
				<Outlet/>
			</AuthProvider>
		</TrpcProvider>
	)
}

export default function LiteratureApp() {
	return (
		<Routes>
			<Route path = { "literature" } element = { <LiteratureOutlet/> }>
				<Route path = { ":gameId" } element = { <GameProvider><PlayPage/></GameProvider> }/>
				<Route index element = { <HomePage/> }/>
			</Route>
		</Routes>
	)
}