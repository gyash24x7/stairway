import { AuthProvider } from "@s2h-ui/auth/context";
import { QueryClientProvider } from "@s2h/client/query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoutes } from "./routes";
import "./styles.css";

const rootElement = document.getElementById( "root" )!;
const root = createRoot( rootElement );
root.render(
	<StrictMode>
		<QueryClientProvider>
			<AuthProvider>
				<AppRoutes/>
			</AuthProvider>
		</QueryClientProvider>
	</StrictMode>
);
