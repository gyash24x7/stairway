import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";

export const Route = createRootRoute( {
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
	shellComponent: ( props ) => {
		return (
			<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent/>
			</head>
			<body className={ "font-sans antialiased" }>
			{ props.children }
			<Scripts/>
			</body>
			</html>
		);
	}
} );
