import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { theme } from "@s2h/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes";

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
		<QueryClientProvider client={ queryClient }>
			<BrowserRouter>
				<MantineProvider theme={ theme }>
					<AppRoutes/>
				</MantineProvider>
			</BrowserRouter>
		</QueryClientProvider>
	</StrictMode>
);
