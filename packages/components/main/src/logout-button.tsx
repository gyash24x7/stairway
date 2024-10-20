"use client";

import { ExitIcon } from "@radix-ui/react-icons";
import { Button } from "@stairway/components/base";
import { Fragment } from "react";

export function LogoutButton( { logout }: { logout: VoidFunction } ) {
	return (
		<Button
			variant={ "ghost" }
			className={ "text-red-600 flex gap-2 items-center" }
			onClick={ () => logout() }
		>
			<Fragment>LOGOUT</Fragment>
			<ExitIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
		</Button>
	);
}