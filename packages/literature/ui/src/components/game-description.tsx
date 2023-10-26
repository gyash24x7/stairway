import { Box, Flex, Text, Title } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { IconCopy } from "@tabler/icons-react";
import { gameDescriptionClassnames as classnames } from "../styles";
import { useGameStore } from "../utils";

export function GameDescription() {
	const code = useGameStore( state => state.gameData!.code );
	const clipboard = useClipboard();

	const copyCode = () => clipboard.copy( code );

	return (
		<Box my={ 8 }>
			<Text>Game Code</Text>
			<Flex justify={ "space-between" } align={ "center" }>
				<Title>{ code }</Title>
				<IconCopy width={ 40 } height={ 40 } className={ classnames.copyIcon } onClick={ copyCode }/>
			</Flex>
		</Box>
	);
}