import { DisplayAuthInfo } from "@/app/components/auth/display-auth-info";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

export const Route = createFileRoute( "/settings" )( {
	component: () => {
		const rootRoute = getRouteApi( "__root__" );
		const authInfo = rootRoute.useLoaderData();
		return (
			<div className={ "flex flex-col items-center" }>
				{ !!authInfo && <DisplayAuthInfo authInfo={ authInfo }/> }
			</div>
		);
	}
} );
