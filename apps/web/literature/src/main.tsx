import "@fontsource/fjalla-one/400.css";
import "@fontsource/montserrat/300.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/800.css";
import "./styles.css";

import { createRoot } from "react-dom/client";
import { LiteratureApp } from "@s2h/literature/ui";

const rootElem = document.getElementById( "root" );
const reactRoot = createRoot( rootElem! );
reactRoot.render( <LiteratureApp/> );