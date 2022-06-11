import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

const root = ReactDOM.createRoot( document.getElementById( 'root' ) as HTMLElement );

root.render(
	<StrictMode>
		<BrowserRouter>
			<h1>Hello From Vite and Nx</h1>
		</BrowserRouter>
	</StrictMode>
);
