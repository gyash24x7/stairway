import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { Fragment, useTransition } from "react";

import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { logoutFn } from "@/auth/client/client.ts";
import { useRefreshAuth } from "@/auth/client/use-auth.tsx";

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
