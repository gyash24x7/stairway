"use client";

import { orpc } from "@/app/client/orpc";
import { Button } from "@/app/primitives/button";
import { Spinner } from "@/app/primitives/spinner";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { Fragment } from "react";

export function LogoutButton() {
	const navigate = useNavigate();
	const { mutateAsync, isPending } = useMutation( orpc.auth.logout.mutationOptions( {
		onSuccess: () => navigate( { to: "/" } )
	} ) );

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