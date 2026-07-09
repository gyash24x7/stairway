import { client } from "@s2h/client";
import { useRefreshAuth } from "../hooks/use-auth";
import { Button } from "../primitives/button";
import { Spinner } from "../primitives/spinner";
import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { Fragment, useTransition } from "react";

export function LogoutButton() {
	const navigate = useNavigate();
	const refreshAuth = useRefreshAuth();
	const [ isPending, startTransition ] = useTransition();

	const handleLogout = () => startTransition( async () => {
		await client.auth.logout();
		await refreshAuth();
		await navigate( { to: "/" } );
	} );

	return (
		<Button className={ "flex gap-2 items-center" } onClick={ handleLogout }>
			{ isPending ? <Spinner/> : (
				<Fragment>
					<Fragment>LOGOUT</Fragment>
					<LogOutIcon className={ "w-4 h-4" }/>
				</Fragment>
			) }
		</Button>
	);
}
