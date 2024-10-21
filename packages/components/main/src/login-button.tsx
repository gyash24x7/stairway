"use client";

import { EnterIcon } from "@radix-ui/react-icons";
import { Button } from "@stairway/components/base";
import { createAuthClient } from "better-auth/react";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

const client = createAuthClient( {
	baseURL: process.env[ "APP_URL" ] ?? "http://localhost:3000"
} );

export function LoginButton() {
	const callbackURL = usePathname();
	const login = () => client.signIn.social( { provider: "google", callbackURL } );

	return (
		<Button className={ "flex gap-2 items-center w-full mb-4" } onClick={ login }>
			<Fragment>LOGIN</Fragment>
			<EnterIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
		</Button>
	);
}