import { PrivateLayout } from "@auth/ui";
import { ErrorPage } from "@s2h/ui";
import { IndexRouteObject, Outlet, RouteObject } from "react-router-dom";
import {
	GamePage,
	GamePageFooter as LiteratureGamePageFooter,
	HomePage as LiteratureHomePage,
	HomePageFooter as LiteratureHomePageFooter
} from "../components";
import { GameProvider, gameStoreLoader } from "../store";

const literatureHomeRoute: IndexRouteObject = {
	index: true,
	element: <PrivateLayout footer={ <LiteratureHomePageFooter/> }><LiteratureHomePage/></PrivateLayout>,
	errorElement: <ErrorPage/>
};

const literatureGameRoute: RouteObject = {
	path: ":gameId",
	element: (
		<GameProvider>
			<PrivateLayout footer={ <LiteratureGamePageFooter/> }>
				<GamePage/>
			</PrivateLayout>
		</GameProvider>
	),
	errorElement: <ErrorPage/>,
	loader: gameStoreLoader
};

export const literatureRoute: RouteObject = {
	path: "literature",
	element: <Outlet/>,
	errorElement: <ErrorPage/>,
	children: [ literatureGameRoute, literatureHomeRoute ]
};