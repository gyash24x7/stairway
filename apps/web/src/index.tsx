import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/saira-extra-condensed/300.css";
import "@fontsource/saira-extra-condensed/600.css";
import "@fontsource/saira-extra-condensed/900.css";

import { theme } from "@common/ui";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { rootRoute } from "./routes";

const root = ReactDOM.createRoot( document.getElementById( "root" ) as HTMLElement );

export const router = createBrowserRouter( [ rootRoute ] );

root.render(
	<StrictMode>
		<MantineProvider theme={ theme }>
			<RouterProvider router={ router }/>
		</MantineProvider>
	</StrictMode>
);
