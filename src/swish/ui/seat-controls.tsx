import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";


export type AutoPlayToggleProps = {
	autoPlaying: boolean;
	setAutoPlay: ( autoPlay: boolean ) => void;
	disabled?: boolean;
};

/**
 * Hand the seat to the bot policy, or take it back.
 *
 * Deliberately `neutral` rather than the accent default: this is a meta-control
 * about who is playing, and it sits in the same bar as the moves themselves. An
 * accent button there competes with the move the seat is actually being asked to
 * make. It was already split across the two variants between games.
 */
export function AutoPlayToggle( { autoPlaying, setAutoPlay, disabled }: AutoPlayToggleProps ) {
	return (
		<Button
			variant={ "neutral" }
			onClick={ () => setAutoPlay( !autoPlaying ) }
			disabled={ disabled }
		>
			{ autoPlaying ? "TAKE MY SEAT BACK" : "LET A BOT PLAY" }
		</Button>
	);
}

export type AddBotsProps = {
	addBots: () => void;
	disabled?: boolean;
};

/** Fill the empty seats with bots. The counterpart to `StartGame` in a lobby. */
export function AddBots( { addBots, disabled }: AddBotsProps ) {
	return (
		<Button onClick={ addBots } disabled={ disabled }>
			{ disabled ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}

export type StartGameProps = {
	startGame: () => void;
	disabled?: boolean;
};

export function StartGame( { startGame, disabled }: StartGameProps ) {
	return (
		<Button onClick={ startGame } disabled={ disabled }>
			{ disabled ? <Spinner/> : "START GAME" }
		</Button>
	);
}
