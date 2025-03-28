"use client";

import { Button } from "@/components/base/button";
import { Spinner } from "@/components/base/spinner";
import { authClient } from "@/utils/auth";
import { LogOutIcon } from "lucide-react";
import { Fragment, useTransition } from "react";

export function LogoutButton() {
	const [ isPending, startTransition ] = useTransition();

	const handleLogout = () => {
		startTransition( async () => {
			await authClient.signOut();
			window.location.href = "/";
		} );
	};

	return (
		<Button className={ "flex gap-2 items-center" } onClick={ handleLogout }>
			{ isPending ? <Spinner/> : (
				<Fragment>
					<Fragment>LOGOUT</Fragment>
					<LogOutIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
				</Fragment>
			) }
		</Button>
	);
}