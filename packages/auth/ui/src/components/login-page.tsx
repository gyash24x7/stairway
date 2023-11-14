import { Box, Button, Flex, Title } from "@mantine/core";
import { IconBrandGoogle } from "@tabler/icons-react";
import { useCallback } from "react";
import { Navigate } from "react-router-dom";
import { authClient, useIsLoggedIn } from "../store";
import { loginPageClassnames as classnames } from "../styles";

export function LoginPage() {
	const isLoggedIn = useIsLoggedIn();

	const login = useCallback( () => {
		window.location.href = authClient.getGoogleAuthUrl();
	}, [] );

	if ( isLoggedIn ) {
		return <Navigate to={ "/" }/>;
	}

	return (
		<Flex className={ classnames.wrapper } justify={ "center" } align={ "center" }>
			<Box className={ classnames.box } p={ 30 }>
				<img src={ "logo.png" } alt={ "logo" } className={ classnames.logo }/>
				<Title order={ 1 } className={ classnames.title } ta={ "center" } mt={ "md" } mb={ 50 }>
					LOGIN
				</Title>
				<Button
					leftSection={ <IconBrandGoogle/> }
					onClick={ login }
				>
					Login With Google
				</Button>
			</Box>
		</Flex>
	);
}