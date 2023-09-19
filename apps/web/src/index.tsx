import "@mantine/core/styles.css";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { theme } from "@s2h/ui";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { MantineProvider } from "@mantine/core";

const root = ReactDOM.createRoot( document.getElementById( "root" ) as HTMLElement );

const queryClient = new QueryClient( {
	defaultOptions: {
		queries: {
			refetchInterval: false,
			refetchOnWindowFocus: false,
			retry: false
		}
	}
} );


root.render(
	<StrictMode>
		<MantineProvider theme={ theme }>
			<QueryClientProvider client={ queryClient }>
				<RouterProvider router={ router }/>
			</QueryClientProvider>
		</MantineProvider>
	</StrictMode>
);
