import React from "react";
import { Avatar, Flex, HStack, VStack } from "@s2h/ui";
import { useGame } from "../utils/game-context";

export function DisplayTeams() {
	const { teams } = useGame();

	return (
		<VStack className = { "divide-light-700 divide-dashed divide-y" }>
			{ teams.map( team => (
				<div className = { "min-w-full my-2" } key = { team?.id }>
					<Flex
						className = { "border-b border-dashed border-light-700 w-full" }
						justify = { "space-between" }
					>
						<h2 className = { "font-semibold text-xl text-left pb-2 pr-2" }>Team { team.name }</h2>
						<h2 className = { "font-semibold text-xl text-right pb-2 pr-2" }>{ team.score }</h2>
					</Flex>
					{ team.members.map( player => (
						<Flex key = { player.id } className = { "py-2 w-full" } justify = { "space-between" }>
							<HStack>
								<Avatar size = { "xs" } name = { player.name } src = { player.avatar }/>
								<h4 className = { "text-base" }>{ player.name }</h4>
							</HStack>
							<div className = { "w-28" }>
								<h4 className = { "text-base text-right" }>
									{ player.hand.length } Cards
								</h4>
							</div>
						</Flex>
					) ) }
				</div>
			) ) }
		</VStack>
	);
}