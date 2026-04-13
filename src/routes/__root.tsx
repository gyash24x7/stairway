import { AuthProvider } from "@/auth/components/context";
import { Navbar } from "@/shared/components/navbar";
import { getTheme } from "@/shared/components/theme-switcher";
import { Toaster } from "@/shared/primitives/sonner";
import { cn, type Theme, type ThemeMode } from "@/shared/utils/cn";
import { queryClient } from "@/shared/utils/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";

export type RouterContext = {
	initialTheme: Theme;
	initialThemeMode: ThemeMode;
}

export const Route = createRootRouteWithContext<RouterContext>()( {
	head: () => ( {
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Stairway" }
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ href: "/s2h.png", rel: "icon", type: "image/png" }
		]
	} ),
	beforeLoad: () => getTheme(),
	shellComponent: ( props ) => {
		const { initialThemeMode, initialTheme } = Route.useRouteContext();
		return (
			<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent/>
			</head>
			<body className={ cn( "antialiased", initialThemeMode, initialTheme ) }>
			<QueryClientProvider client={ queryClient }>
				<AuthProvider>
					<main className="flex min-h-screen flex-col bg-surface">
						<Navbar/>
						<div className={ "px-2 py-2 md:px-4 md:py-4 md:mt-20 mt-15 w-full flex justify-center" }>
							{ props.children }
						</div>
						<Toaster/>
					</main>
				</AuthProvider>
			</QueryClientProvider>
			<Scripts/>
			</body>
			</html>
		);
	}
} );
