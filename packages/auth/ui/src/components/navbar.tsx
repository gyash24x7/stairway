import { ActionIcon, Flex } from "@mantine/core";
import { useAction } from "@s2h/ui";
import { IconPower } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { navBarClassnames as classnames } from "../styles";
import { useAuthStore } from "../utils";
import { UserCard } from "./user-card";

export function Navbar() {
	const logout = useAuthStore( store => store.logout );
	const navigate = useNavigate();

	const { execute, isLoading } = useAction(
		async () => {
			await logout();
			navigate( "/auth/login" );
		}
	);

	return (
		<Flex justify={ "space-between" } align={ "center" } className={ classnames.userInfo } p={ "md" }>
			<UserCard/>
			<ActionIcon onClick={ execute } size="lg" color={ "danger" } loading={ isLoading }>
				<IconPower size={ "1.2rem" }/>
			</ActionIcon>
		</Flex>
	);
}