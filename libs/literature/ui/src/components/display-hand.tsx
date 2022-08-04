import React from "react";
import { DisplayCard } from "./display-card";
import { useGame } from "../utils/game-context";
import { HStack } from "@s2h/ui";

export const DisplayHand = function () {
	const { loggedInPlayer } = useGame();

	return (
		<div className = { "w-full py-4 lg:py-0" }>
			<h3 className = { "text-xl mb-2 font-semibold" }>Your Hand</h3>
			<HStack wrap spacing = { "sm" } stackItemClassName = { "my-2" }>
				{ loggedInPlayer?.hand.sorted().map( card => (
					<DisplayCard card = { card } key = { card.id }/>
				) ) }
			</HStack>
		</div>
	);
};