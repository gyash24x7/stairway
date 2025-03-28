"use client";

import { Button } from "@/components/base/button";
import { Spinner } from "@/components/base/spinner";
import { authClient } from "@/utils/auth";
import { EnterIcon } from "@radix-ui/react-icons";
import { Fragment, useTransition } from "react";

export function LoginButton() {
	const [ isPending, startTransition ] = useTransition();

	const handleLogin = () => {
		startTransition( async () => {
			await authClient.signIn.social( { provider: "google", callbackURL: window.location.href } );
		} );
	};

	return (
		<Button className={ "flex gap-2 items-center" } onClick={ handleLogin } disabled={ isPending }>
			{ isPending ? <Spinner/> : (
				<Fragment>
					<Fragment>LOGIN</Fragment>
					<EnterIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
				</Fragment>
			) }
		</Button>
	);
}