import { useAuth } from "../utils";
import { Avatar, Box, Group, Text, Title } from "@mantine/core";
import { IconAt } from "@tabler/icons-react";
import { userCardClassnames as classnames } from "../styles/components.css";

export function UserCard() {
	const { user } = useAuth();

	return (
		<Group wrap={ "nowrap" }>
			<Avatar src={ user?.avatar } size={ 64 } radius={ "50%" }/>
			<Box>
				<Title order={ 5 }>{ user?.name }</Title>
				<Group wrap={ "nowrap" } gap={ 10 } mt={ 3 }>
					<IconAt stroke={ 1.5 } size={ 16 } className={ classnames.icon }/>
					<Text fz={ "xs" } c={ "dimmed" }>{ user?.email }</Text>
				</Group>
			</Box>
		</Group>
	);
}