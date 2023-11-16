import { authClient, useAuthInfo, useIsLoggedIn, useLogoutAction } from "@auth/ui";
import { Avatar, Button, Group } from "@mantine/core";
import { IconBrandGoogle } from "@tabler/icons-react";
import { Fragment, useCallback } from "react";

export function DisplayAuthInfo() {
	const isLoggedIn = useIsLoggedIn();
	const authInfo = useAuthInfo();
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
					<Avatar src={ authInfo?.avatar } size={ 48 } radius={ "50%" }/>
				</Group>
			) : (
				<Button leftSection={ <IconBrandGoogle/> } onClick={ login }>Login With Google</Button>
			) }
		</Fragment>
	);
}