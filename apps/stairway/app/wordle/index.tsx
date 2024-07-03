import { Box, Divider, Heading, VStack } from "@gluestack-ui/themed";
import { CreateGame } from "@wordle/ui";

export default function WordleHomeScreen() {
	return (
		<VStack width={ "100%" } justifyContent={ "center" } p={ "$5" } mb={ "$20" }>
			<Box flexDirection={ "row" } justifyContent={ "space-between" } alignItems={ "center" }>
				<Heading size={ "3xl" } fontFamily={ "fjalla" }>WORDLE</Heading>
				<CreateGame/>
			</Box>
			<Divider my={ "$5" }/>
		</VStack>
	);
}
