import { AuthProvider } from "./utils/auth";
import { TrpcProvider } from "./utils/trpc";
import { AppRoutes } from "./routes";
import "./styles/globals.css";
import { createRoot } from "react-dom/client";

function App() {
	return (
		<TrpcProvider>
			<AuthProvider>
				<AppRoutes/>
			</AuthProvider>
		</TrpcProvider>
	);
}

const rootElem = document.getElementById( "root" );
const reactRoot = createRoot( rootElem! );
reactRoot.render( <App/> );