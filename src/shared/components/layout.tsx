import { Navbar } from "@/shared/components/navbar";
import { cn } from "@/shared/utils/cn";
import type { LayoutProps } from "rwsdk/worker";

export function AppLayout( { children, requestInfo }: LayoutProps ) {
	const initialThemeMode = requestInfo?.ctx.themeMode ?? "light";
	const initialTheme = requestInfo?.ctx.theme ?? "apple";
	return (
		<main className="flex min-h-screen flex-col bg-surface">
			<Navbar
				initialTheme={ initialTheme }
				initialThemeMode={ initialThemeMode }
				authInfo={ requestInfo?.ctx.authInfo ?? null }
			/>
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