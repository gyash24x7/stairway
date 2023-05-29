import { Avatar, Flex, HStack, VStack } from "@s2h/ui";

import { useGame } from "../utils";

export function DisplayTeams() {
	const { teamList, players } = useGame();

	return (
		<VStack className={ "divide-light-700 divide-dashed divide-y" }>
			{ teamList.map( team => (
				<div className={ "min-w-full my-2" } key={ team.name }>
					<Flex
						className={ "border-b border-dashed border-light-700 w-full" }
						justify={ "space-between" }
					>
						<h2 className={ "font-semibold text-xl text-left pb-2 pr-2" }>Team { team.name }</h2>
						<h2 className={ "font-semibold text-xl text-right pb-2 pr-2" }>{ team.score }</h2>
					</Flex>
					{ team.members.map( playerId => (
						<Flex key={ playerId } className={ "py-2 w-full" } justify={ "space-between" }>
							<HStack>
								<Avatar
									size={ "xs" }
									name={ players[ playerId ].name }
									src={ players[ playerId ].avatar }
								/>
								<h4 className={ "text-base" }>{ players[ playerId ].name }</h4>
							</HStack>
							<div className={ "w-28" }>
								<h4 className={ "text-base text-right" }>
									{ players[ playerId ].hand.length } Cards
								</h4>
							</div>
						</Flex>
					) ) }
				</div>
			) ) }
		</VStack>
	);
}