import { Box, Button, ButtonIcon, Heading, HStack, Text } from "@gluestack-ui/themed";
import { CopyIcon } from "lucide-react-native";
import { useGameCode } from "../store";

export function GameCode() {
	const code = useGameCode();
	return (
		<Box
			flexDirection={ "row" }
			p={ "$3" }
			justifyContent={ "space-between" }
			alignItems={ "center" }
			borderWidth={ "$2" }
			borderColor={ "$borderDark100" }
			borderRadius={ "$md" }
		>
			<Box>
				<Text size={ "sm" }>GAME CODE</Text>
				<Heading size={ "3xl" }>{ code }</Heading>
			</Box>
			<HStack gap={ "$5" }>
				<Button variant={ "link" }>
					<ButtonIcon as={ CopyIcon } color={ "primary" } size={ "xl" }/>
				</Button>
			</HStack>
		</Box>
	);
}