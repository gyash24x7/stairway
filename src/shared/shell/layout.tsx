import { cn } from "cn";
import type { ReactNode } from "react";
import { Outlet } from "react-router";

import { Toaster } from "@/shared/primitives/sonner";
import { Navbar } from "@/shared/shell/navbar";

export function AppLayout( props: { children: ReactNode } ) {
	return (
		<main className="flex min-h-screen flex-col bg-surface">
			<Navbar>{ props.children }</Navbar>
			<div
				className={ cn(
					"px-2 py-2 md:px-4 md:py-4 md:mt-20",
					"mt-15 w-full flex justify-center"
				) }
			>
				<Outlet/>
			</div>
			<Toaster position={ "bottom-right" } duration={ 4000 }/>
		</main>
	);
}

export function CouchLayout() {
	return (
		<main className={ "min-h-screen bg-surface" }>
			<Outlet/>
			<Toaster position={ "bottom-right" } duration={ 4000 }/>
		</main>
	);
}
