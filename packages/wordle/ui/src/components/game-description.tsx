import { Card } from "@common/ui";
import { Flex, Title } from "@mantine/core";

export function GameDescription() {
	return (
		<Card>
			<Flex justify={ "center" } align={ "center" } ta={ "center" }>
				<Title fz={ 56 } lh={ 1 }>WORDLE</Title>
			</Flex>
		</Card>
	);
}