import type { ReactNode } from "react";
import { requestInfo } from "rwsdk/worker";
import styles from "./styles.css?url";

export function Document( props: { children: ReactNode } ) {
	const initialTheme = requestInfo.ctx.theme;
	const initialThemeMode = requestInfo.ctx.themeMode;

	return (
		<html lang="en">
		<head>
			<meta charSet="utf-8"/>
			<meta name="viewport" content="width=device-width, initial-scale=1"/>
			<title>Stairway</title>
			<link rel="modulepreload" href="/src/client.tsx"/>
			<link rel="stylesheet" href={ styles }/>
		</head>
		<body>
		{ props.children }
		<script>import("/src/client.tsx")</script>
		<script
			dangerouslySetInnerHTML={ {
				__html: `
              (function() {
                const theme = "${ initialTheme }";
                const themeMode = "${ initialThemeMode }";
                document.body.classList.add(theme, themeMode);
              })();
            `
			} }
		/>
		</body>
		</html>
	);
}
