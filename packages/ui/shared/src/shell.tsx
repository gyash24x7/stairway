import { Outlet } from "@tanstack/react-router";
import { Navbar } from "./navbar";

export function Shell() {
	return (
		<main className="flex min-h-screen flex-col bg-bg">
			<Navbar/>
			<div className={ "px-2 py-2 md:px-4 md:py-4 md:mt-[100px] mt-[76px]" }>
				<Outlet/>
			</div>
		</main>
	);
}