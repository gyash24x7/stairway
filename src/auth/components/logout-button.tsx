import { logout } from "@/auth/core/actions";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { queryClient } from "@/shared/utils/query-client";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOutIcon } from "lucide-react";
import { Fragment } from "react";

export function LogoutButton() {
	const logoutFn = useServerFn( logout );
	const { mutate, isPending } = useMutation( {
		mutationFn: logoutFn,
		onSuccess: () => queryClient.invalidateQueries( { queryKey: [ "authInfo" ] } )
	} );

	return (
		<Button className={ "flex gap-2 items-center" } onClick={ () => mutate( {} ) }>
			{ isPending ? <Spinner/> : (
				<Fragment>
					<Fragment>LOGOUT</Fragment>
					<LogOutIcon className={ "w-4 h-4" }/>
				</Fragment>
			) }
		</Button>
	);
}