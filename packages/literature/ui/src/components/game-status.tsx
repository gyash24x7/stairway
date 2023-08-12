import { Banner, HStack, VStack } from "@s2h/ui";
import { useCurrentPlayer, useGame } from "../utils";
import { AskCard } from "./ask-card";
import { CallSet } from "./call-set";
import { PlayerCard } from "./player-card";
import { PreviousMoves } from "./previous-moves";

export function GameStatus() {
	const { status, players, moves, currentTurn } = useGame();
	const loggedInPlayer = useCurrentPlayer();

	return (
		<VStack className={ "w-full py-4 lg:py-0" } spacing={ "2xl" }>
			<Banner message={ moves[ 0 ]?.description }/>
			{ status === "IN_PROGRESS" && (
				<HStack>
					<h2 className={ "font-fjalla text-3xl text-dark-700" }>TURN:</h2>
					<PlayerCard player={ players[ currentTurn ] } size={ "md" }/>
				</HStack>
			) }
			<HStack>
				<PreviousMoves/>
				{ currentTurn === loggedInPlayer?.id && (
					<HStack>
						<AskCard/>
						<CallSet/>
					</HStack>
				) }
			</HStack>
		</VStack>
	);
}