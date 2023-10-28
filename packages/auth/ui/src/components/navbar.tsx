import { ActionIcon, Flex } from "@mantine/core";
import { IconPower } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { navBarClassnames as classnames } from "../styles";
import { useLogoutAction } from "../utils";
import { UserCard } from "./user-card";
import { useCallback } from "react";

export function Navbar() {
	const navigate = useNavigate();

	const { execute, isLoading } = useLogoutAction();

	const handleLogout = useCallback( () => execute( {} ).then( () => navigate( "/login" ) ), [] );

	return (
		<Flex justify={ "space-between" } align={ "center" } className={ classnames.userInfo } p={ "md" }>
			<UserCard/>
			<ActionIcon onClick={ handleLogout } size="lg" color={ "danger" } loading={ isLoading }>
				<IconPower size={ "1.2rem" }/>
			</ActionIcon>
		</Flex>
	);
}