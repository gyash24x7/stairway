import { Box, Flex, Text, Title } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { IconCopy } from "@tabler/icons-react";
import { gameDescriptionClassnames as classnames } from "../styles";
import { useGameData } from "../utils";
import { useCallback } from "react";

export function GameDescription() {
	const { code } = useGameData()!;
	const clipboard = useClipboard();

	const copyCode = useCallback( () => clipboard.copy( code ), [ code ] );

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