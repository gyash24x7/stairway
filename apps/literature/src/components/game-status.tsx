import { Fragment } from "react";
import { useGame } from "../utils/game-context";
import { Banner, HStack, VStack } from "@s2h/ui";
import { PlayerCard } from "./player-card";
import { AskCard } from "./ask-card";
import { LitMoveType } from "@prisma/client";
import { GiveCard } from "./give-card";
import { DeclineCard } from "./decline-card";
import { CallSet } from "./call-set";
import { TransferTurn } from "./transfer-turn";
import { PreviousMoves } from "./previous-moves";

export function GameStatus() {
	const { status, players, moves, loggedInPlayer } = useGame();

	const hasAskedCard = () => {
		if ( !moves[ 0 ] ) {
			return false;
		}
		return !!loggedInPlayer?.hand.contains( moves[ 0 ].askedFor! );
	};

	const getCurrentMovePlayer = () => {
		if ( !moves[ 0 ] ) {
			return;
		}

		switch ( moves[ 0 ].type ) {
			case "ASK":
				return players.find( player => player.id === moves[ 0 ].askedFromId );
			default:
				return players.find( player => player.id === moves[ 0 ].turnId );
		}
	};

	return (
		<VStack className = { "w-full py-4 lg:py-0" } spacing = { "2xl" }>
			<Banner message = { moves[ 0 ].description }/>
			{ status === "IN_PROGRESS" && (
				<HStack>
					<h2 className = { "font-fjalla text-3xl text-dark-700" }>TURN:</h2>
					<PlayerCard player = { getCurrentMovePlayer() || loggedInPlayer! } size = { "md" }/>
				</HStack>
			) }
			<HStack>
				<PreviousMoves/>
				{ moves[ 0 ]?.turnId === loggedInPlayer?.id && (
					<Fragment>
						{ loggedInPlayer.hand.length > 0
							? (
								<HStack>
									<AskCard/>
									<CallSet/>
								</HStack>
							)
							: <TransferTurn/>
						}
					</Fragment>
				) }
				{ moves[ 0 ]?.type === LitMoveType.ASK && moves[ 0 ]?.askedFromId === loggedInPlayer?.id && (
					<Fragment>{ hasAskedCard() ? <GiveCard/> : <DeclineCard/> }</Fragment>
				) }
			</HStack>
		</VStack>
	);
}