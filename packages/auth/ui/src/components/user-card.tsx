import { useAuth } from "../utils";
import { Avatar, Box, Group, Text, Title } from "@mantine/core";

export function UserCard() {
	const { user } = useAuth();

	return (
		<Group wrap={ "nowrap" }>
			<Avatar src={ user?.avatar } size={ 64 } radius={ "50%" }/>
			<Box>
				<Title order={ 3 } fz={ 28 }>{ user?.name }</Title>
				<Text fz={ "xs" } c={ "dimmed" }>{ user?.email }</Text>
			</Box>
		</Group>
	);
}