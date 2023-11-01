import { Avatar, Button, Group } from "@mantine/core";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthInfo, useLogoutAction } from "../store";

export function DisplayAuthInfo() {
	const authInfo = useAuthInfo();
	const navigate = useNavigate();
	const { execute, isLoading } = useLogoutAction();
	const handleLogout = useCallback( () => execute( {} ).then( () => navigate( "/auth/login" ) ), [] );

	return (
		<Group>
			<Button color={ "danger" } fw={ 700 } size={ "xs" } onClick={ handleLogout } loading={ isLoading }>
				LOGOUT
			</Button>
			<Avatar src={ authInfo?.avatar } size={ 48 } radius={ "50%" }/>
		</Group>
	);
}