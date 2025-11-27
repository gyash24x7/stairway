"use client";

import { Button } from "@s2h-ui/primitives/button";
import { LogOutIcon } from "@s2h-ui/primitives/icons";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { useLogoutMutation } from "@s2h/client/auth";
import { Fragment } from "react";

export function LogoutButton() {
	const { mutateAsync, isPending } = useLogoutMutation();
	const handleLogout = () => mutateAsync();

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