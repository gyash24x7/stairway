import type { ReactNode } from "react";
import type { DocumentProps } from "rwsdk/router";
import { TurnstileScript } from "rwsdk/turnstile";
import styles from "./styles/globals.css?url";

export function Document( { children }: DocumentProps ) {
	return (
		<html lang="en">
		<head>
			<meta charSet="utf-8"/>
			<meta name="viewport" content="width=device-width, initial-scale=1"/>
			<title>Stairway</title>
			<link rel="preconnect" href="https://fonts.googleapis.com"/>
			<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin={ "" }/>
			<link rel="modulepreload" href="/src/client.tsx"/>
			<link rel="stylesheet" href={ styles }/>
			<TurnstileScript/>
		</head>
		<body>
		<div id="root">{ children as ReactNode }</div>
		<script>import("/src/client.tsx")</script>
		</body>
		</html>
	);
}
