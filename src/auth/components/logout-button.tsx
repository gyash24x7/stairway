"use client";

import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { LogOutIcon } from "lucide-react";
import { Fragment, useTransition } from "react";
import { default as axios } from "redaxios";

export function LogoutButton() {
	const [ isPending, startTransition ] = useTransition();

	const handleLogout = () => startTransition( async () => {
		const response = await axios.delete( "/auth/logout", { withCredentials: true } );
		window.location.href = response.url;
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