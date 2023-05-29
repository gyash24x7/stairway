import { Banner, HStack, VStack } from "@s2h/ui";
import { useCurrentPlayer, useGame } from "../utils";
import { AskCard } from "./ask-card";
import { CallSet } from "./call-set";
import { PlayerCard } from "./player-card";
import { PreviousMoves } from "./previous-moves";

export function GameStatus() {
	const { status, players, moves, currentTurn } = useGame();
	const loggedInPlayer = useCurrentPlayer();

	const getCurrentMovePlayer = () => {
		if ( !moves[ 0 ] ) {
			return;
		}

		switch ( moves[ 0 ].actionData.action ) {
			case "ASK":
				return players[ moves[ 0 ].actionData.askData!.from ];
			default:
				return players[ currentTurn ];
		}
	};

	console.log( moves[ 0 ] );
	console.log( loggedInPlayer );

	return (
		<VStack className={ "w-full py-4 lg:py-0" } spacing={ "2xl" }>
			<Banner message={ moves[ 0 ]?.description }/>
			{ status === "IN_PROGRESS" && (
				<HStack>
					<h2 className={ "font-fjalla text-3xl text-dark-700" }>TURN:</h2>
					<PlayerCard player={ getCurrentMovePlayer() || loggedInPlayer! } size={ "md" }/>
				</HStack>
			) }
			<HStack>
				<PreviousMoves/>
				<HStack>
					<AskCard/>
					<CallSet/>
				</HStack>
			</HStack>
		</VStack>
	);
}