"use client";

import { Button } from "@/components/base/button";
import { Spinner } from "@/components/base/spinner";
import { authClient } from "@/utils/auth";
import { LogInIcon } from "lucide-react";
import { Fragment, useTransition } from "react";

export function LoginButton() {
	const [ isPending, startTransition ] = useTransition();

	const handleLogin = () => {
		startTransition( async () => {
			await authClient.signIn.social( { provider: "google", callbackURL: window.location.href } );
		} );
	};

	return (
		<Button className={ "flex gap-2 items-center" } onClick={ handleLogin } disabled={ isPending } size={ "sm" }>
			{ isPending ? <Spinner/> : (
				<Fragment>
					<Fragment>LOGIN</Fragment>
					<LogInIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
				</Fragment>
			) }
		</Button>
	);
}