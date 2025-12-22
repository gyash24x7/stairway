import { Toaster } from "@s2h-ui/primitives/sonner";
import { Outlet } from "@tanstack/react-router";
import { Navbar } from "./navbar.tsx";

export function Shell() {
	return (
		<main className="flex min-h-screen flex-col bg-bg">
			<Navbar/>
			<div className={ "px-2 py-2 md:px-4 md:py-4 md:mt-25 mt-19" }>
				<Outlet/>
			</div>
			<Toaster/>
		</main>
	);
}