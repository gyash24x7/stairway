import { useGameCode } from "@literature/store";
import { Box, Text, Title } from "@mantine/core";

export function GameCode() {
	const code = useGameCode();
	return (
		<Box>
			<Text fz={ 14 } fw={ 700 } lh={ 1 }>GAME CODE</Text>
			<Title fz={ 56 } lh={ 1 }>{ code }</Title>
		</Box>
	);
}