import { Group, Loader, Text } from "@mantine/core";
import { Card } from "./card";

export interface BannerProps {
	isLoading?: boolean;
	message: string;
}

export function Banner( { message, isLoading }: BannerProps ) {
	return (
		<Card>
			<Group>
				{ isLoading && <Loader size={ "sm" }/> }
				<Text fw={ 700 }>{ message }</Text>
			</Group>
		</Card>
	);
}