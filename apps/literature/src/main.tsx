import "@fontsource/fjalla-one/400.css";
import "@fontsource/montserrat/300.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/800.css";
import { LiteratureApp } from "@s2h/literature/ui";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles.css";

function App() {
	return (
		<BrowserRouter>
			<LiteratureApp/>
		</BrowserRouter>
	);
}

const rootElem = document.getElementById( "root" );
const reactRoot = createRoot( rootElem! );
reactRoot.render( <App/> );