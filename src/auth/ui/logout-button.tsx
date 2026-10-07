import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { LogOutIcon } from "lucide-react";
import { Fragment } from "react";
import { useNavigate } from "react-router";

import { logoutAtom } from "@/auth/ui/client";
import { Button } from "@/shared/primitives/button";
import { toast } from "@/shared/primitives/sonner";
import { Spinner } from "@/shared/primitives/spinner";


export function LogoutButton() {
	const navigate = useNavigate();

	const logout = useAtomSet( logoutAtom, { mode: "promiseExit" } );
	const result = useAtomValue( logoutAtom );

	// The atom's "me" reactivity key refetches the session once the cookie is
	// cleared, which swaps this button's own dialog back to the login button.
	const handleLogout = async () => {
		const exit = await logout();

		if ( Exit.isFailure( exit ) ) {
			console.error( exit.cause );
			const failure = Cause.findErrorOption( exit.cause );
			console.error( failure );
			toast.error( "Something went wrong!" );
			return;
		}

		await navigate( "/" );
	};

	return (
		<Button
			className={ "flex gap-2 items-center" }
			onClick={ handleLogout }
			disabled={ result.waiting }
		>
			{ result.waiting ? <Spinner/> : (
				<Fragment>
					<Fragment>LOGOUT</Fragment>
					<LogOutIcon className={ "w-4 h-4" }/>
				</Fragment>
			) }
		</Button>
	);
}
