import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Ui } from "@s2h/ui";
import "./styles.css";

const root = ReactDOM.createRoot( document.getElementById( 'root' ) as HTMLElement );

root.render(
	<StrictMode>
		<BrowserRouter>
			<h1>Hello From Vite and Nx</h1>
			<Ui/>
		</BrowserRouter>
	</StrictMode>
);
