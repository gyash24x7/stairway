import "./styles.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import LiteratureApp from "@s2h/literature/ui";

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