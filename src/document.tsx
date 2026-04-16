import type { ReactNode } from "react";
import styles from "./styles.css?url";

export function Document( { children }: { children: ReactNode } ) {
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
		{ children }
		<script>import("/src/client.tsx")</script>
		</body>
		</html>
	);
}
