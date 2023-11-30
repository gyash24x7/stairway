import { Card } from "@common/ui";
import { useGameCode, useGameStatus, usePlayers, useTeams } from "@literature/store";
import { Box, Flex, Text, Title } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { IconCopy } from "@tabler/icons-react";
import { useCallback, useMemo } from "react";
import classnames from "../styles/components.module.css";
import { GameCode } from "./game-code";

export function GameDescription() {
	const code = useGameCode();
	const status = useGameStatus();
	const teams = useTeams();
	const players = usePlayers();

	const teamList = useMemo( () => Object.values( teams ), [ teams ] );
	const clipboard = useClipboard();

	const copyCode = useCallback( () => clipboard.copy( code ), [ code ] );

	const displayTeams = useMemo( () => {
		const correctStatus = status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED";
		const hasTeams = teamList.length === 2;
		return correctStatus && hasTeams;
	}, [ status, teamList ] );

	return (
		<Card>
			{ displayTeams ? (
				<Flex justify={ "space-between" } gap={ 20 }>
					<Box className={ classnames[ "teamBox" ] } ta={ "right" }>
						<Title>{ teamList[ 0 ].name }</Title>
						<Text fw={ 700 } c={ "dimmed" }>
							{ teamList[ 0 ].members
								.map( member => players[ member ].name.toUpperCase() )
								.join( ", " )
							}
						</Text>
					</Box>
					<Title>{ teamList[ 0 ].score }&nbsp;-&nbsp;{ teamList[ 1 ].score }</Title>
					<Box className={ classnames[ "teamBox" ] }>
						<Title>{ teamList[ 1 ].name }</Title>
						<Text fw={ 700 } c={ "dimmed" }>
							{ teamList[ 1 ].members
								.map( member => players[ member ].name.toUpperCase() )
								.join( ", " )
							}
						</Text>
					</Box>
				</Flex>
			) : (
				<Flex justify={ "space-between" } align={ "center" }>
					<GameCode/>
					<IconCopy
						width={ 40 }
						height={ 40 }
						className={ classnames[ "copyIcon" ] }
						onClick={ copyCode }
					/>
				</Flex>
			) }
		</Card>
	);
}