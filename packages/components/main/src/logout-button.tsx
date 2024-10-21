"use client";

import { ExitIcon } from "@radix-ui/react-icons";
import { Button, Spinner } from "@stairway/components/base";
import { Fragment, useTransition } from "react";

export function LogoutButton( { logout }: { logout: () => Promise<void> } ) {
	const [ isPending, startTransition ] = useTransition();

	const handleLogout = () => {
		startTransition( async () => {
			await logout();
		} );
	};

	return (
		<Button
			variant={ "ghost" }
			className={ "text-red-600 flex gap-2 items-center" }
			onClick={ handleLogout }
		>
			{ isPending ? <Spinner/> : <Fragment>LOGOUT</Fragment> }
			<ExitIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
		</Button>
	);
}