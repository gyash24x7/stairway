import { useCurrentGame } from "../utils";
import { gameDescriptionClassnames as classnames } from "../styles";
import { useClipboard } from "@mantine/hooks";
import { IconCopy } from "@tabler/icons-react";
import { Box, Flex, Text, Title } from "@mantine/core";

export function GameDescription() {
	const { code } = useCurrentGame();
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