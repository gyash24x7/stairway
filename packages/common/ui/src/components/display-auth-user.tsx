import { Avatar, Button, Group } from "@mantine/core";
import { IconBrandGoogle } from "@tabler/icons-react";
import { Fragment, useCallback } from "react";
import { authClient, useAuthUser, useIsLoggedIn, useLogoutAction } from "../auth";

export function DisplayAuthUser() {
	const isLoggedIn = useIsLoggedIn();
	const authUser = useAuthUser();
	const { execute, isLoading } = useLogoutAction();

	const login = useCallback( () => {
		window.location.href = authClient.getGoogleAuthUrl();
	}, [] );

	return (
		<Fragment>
			{ isLoggedIn ? (
				<Group>
					<Button color={ "danger" } fw={ 700 } size={ "xs" } onClick={ execute } loading={ isLoading }>
						LOGOUT
					</Button>
					<Avatar src={ authUser?.avatar } size={ 48 } radius={ "50%" }/>
				</Group>
			) : (
				<Button leftSection={ <IconBrandGoogle/> } onClick={ login }>Login With Google</Button>
			) }
		</Fragment>
	);
}