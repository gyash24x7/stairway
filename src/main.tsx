import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const rootElem = document.getElementById( "root" )!;
const root = createRoot( rootElem );

root.render(
	<StrictMode>
		<div className={ "text-5xl" }>Hello World</div>
	</StrictMode>
);
