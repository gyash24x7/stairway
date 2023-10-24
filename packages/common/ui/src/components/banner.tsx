import { Box, Group, Loader, Text } from "@mantine/core";

export interface BannerProps {
	isLoading?: boolean;
	message: string;
}

export function Banner( { message, isLoading }: BannerProps ) {
	return (
		<Box p={ 16 } w={ "100%" }>
			<Group>
				{ isLoading && <Loader size={ "sm" }/> }
				<Text>{ message }</Text>
			</Group>
		</Box>
	);
}