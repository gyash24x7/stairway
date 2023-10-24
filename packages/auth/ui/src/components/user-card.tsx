import { useAuthStore } from "../utils";
import { Avatar, Box, Group, Text, Title } from "@mantine/core";

export function UserCard() {
	const { authInfo } = useAuthStore();

	return (
		<Group wrap={ "nowrap" }>
			<Avatar src={ authInfo?.avatar } size={ 64 } radius={ "50%" }/>
			<Box>
				<Title order={ 3 } fz={ 28 }>{ authInfo?.name }</Title>
				<Text fz={ "xs" } c={ "dimmed" }>{ authInfo?.email }</Text>
			</Box>
		</Group>
	);
}