import { Box, Flex, Text, Title } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { IconCopy } from "@tabler/icons-react";
import { gameDescriptionClassnames as classnames } from "../styles";
import { useGameData } from "../utils";
import { useCallback, useMemo } from "react";
import { Card } from "@s2h/ui";

export function GameDescription() {
	const { code, teams, players, status } = useGameData()!;
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
					<Box className={ classnames.teamBox } ta={ "right" }>
						<Title>{ teamList[ 0 ].name }</Title>
						<Text fw={ 700 } c={ "dimmed" }>
							{ teamList[ 0 ].members
								.map( member => players[ member ].name.toUpperCase() )
								.join( ", " )
							}
						</Text>
					</Box>
					<Title>{ teamList[ 0 ].score }&nbsp;-&nbsp;{ teamList[ 1 ].score }</Title>
					<Box className={ classnames.teamBox }>
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
					<Box>
						<Text fz={ 14 } fw={ 700 } lh={ 1 }>GAME CODE</Text>
						<Title fz={ 56 } lh={ 1 }>{ code }</Title>
					</Box>
					<IconCopy
						width={ 40 }
						height={ 40 }
						className={ classnames.copyIcon }
						onClick={ copyCode }
					/>
				</Flex>
			) }
		</Card>
	);
}