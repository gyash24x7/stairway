import { Button } from "@/shared/ui/primitives/button";
import { Spinner } from "@/shared/ui/primitives/spinner";
import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { Fragment, useTransition } from "react";
import { logoutFn } from "./client.ts";
import { useRefreshAuth } from "./use-auth.tsx";

export function LogoutButton() {
	const navigate = useNavigate();
	const refreshAuth = useRefreshAuth();
	const [ isPending, startTransition ] = useTransition();

	const handleLogout = () => startTransition( async () => {
		await logoutFn();
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
