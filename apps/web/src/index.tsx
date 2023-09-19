import "@mantine/core/styles.css";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { theme } from "@s2h/ui";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";

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
					<ModalsProvider>
						<AppRoutes/>
					</ModalsProvider>
				</MantineProvider>
			</BrowserRouter>
		</QueryClientProvider>
	</StrictMode>
);
