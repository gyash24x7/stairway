import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { theme } from "@s2h/ui";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes";

const root = ReactDOM.createRoot( document.getElementById( "root" ) as HTMLElement );

root.render(
	<StrictMode>
		<MantineProvider theme={ theme }>
			<BrowserRouter>
				<AppRoutes/>
			</BrowserRouter>
		</MantineProvider>
	</StrictMode>
);
