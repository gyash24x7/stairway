import { ActionIcon, Flex } from "@mantine/core";
import { navBarClassnames as classnames } from "../styles";
import { UserCard } from "./user-card";
import { IconPower } from "@tabler/icons-react";
import { useAuth } from "../utils";
import { useNavigate } from "react-router-dom";
import { useLogoutMutation } from "@auth/client";

export function Navbar() {
	const { refetchAuthInfo } = useAuth();
	const navigate = useNavigate();

	const { mutateAsync, isLoading } = useLogoutMutation( {
		onSuccess: () => {
			refetchAuthInfo();
			navigate( "/auth/login" );
		}
	} );

	const logout = () => mutateAsync();

	return (
		<Flex justify={ "space-between" } align={ "center" } className={ classnames.userInfo } p={ "md" }>
			<UserCard/>
			<ActionIcon onClick={ logout } size="lg" color={ "danger" } loading={ isLoading }>
				<IconPower size={ "1.2rem" }/>
			</ActionIcon>
		</Flex>
	);
}