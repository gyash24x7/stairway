import { useNavigate } from "react-router-dom";
import { ActionIcon, Box, Flex } from "@mantine/core";
import { UserCard } from "@auth/ui";
import { useLogoutMutation } from "@auth/client";
import { IconPower } from "@tabler/icons-react";
import { homePageClassnames as classnames } from "../styles";
import { ApplicationCard } from "@s2h/ui";

export function HomePage() {
	const navigate = useNavigate();

	const { mutateAsync, isLoading } = useLogoutMutation( {
		onSuccess: () => navigate( "/auth/login" )
	} );

	const logout = () => mutateAsync();

	return (
		<Box p={ "xl" }>
			<Flex justify={ "space-between" } align={ "center" } className={ classnames.userInfo } p={ "md" }>
				<UserCard/>
				<ActionIcon onClick={ logout } size="lg" color={ "danger" } loading={ isLoading }>
					<IconPower size={ "1.2rem" }/>
				</ActionIcon>
			</Flex>
			<Flex gap={ "lg" } mt={ "lg" }>
				<ApplicationCard category={ "Games" } name={ "Literature" } path={ "/literature" }/>
				<ApplicationCard category={ "Games" } name={ "Callbreak" } path={ "/callbreak" }/>
			</Flex>
		</Box>
	);
}