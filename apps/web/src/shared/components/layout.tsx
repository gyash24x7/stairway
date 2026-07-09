import { Navbar } from "@/shared/components/navbar";
import { cn } from "@s2h/shared/utils/cn";
import type { ReactNode } from "react";

export function AppLayout( { children }: { children: ReactNode } ) {
	return (
		<main className="flex min-h-screen flex-col bg-surface">
			<Navbar/>
			<div
				className={ cn(
					"px-2 py-2 md:px-4 md:py-4 md:mt-20",
					"mt-15 w-full flex justify-center"
				) }
			>
				{ children }
			</div>
		</main>
	);
}
