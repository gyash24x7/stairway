import { useNavigate } from "react-router-dom";
import { useLogoutAction } from "../utils";
import { useCallback } from "react";
import { Button } from "@mantine/core";

export function Logout() {

	const navigate = useNavigate();

	const { execute, isLoading } = useLogoutAction();

	const handleLogout = useCallback( () => execute( {} ).then( () => navigate( "/auth/login" ) ), [] );

	return (
		<Button color={ "danger" } fw={ 700 } size={ "xs" } onClick={ handleLogout } loading={ isLoading }>
			LOGOUT
		</Button>
	);
}