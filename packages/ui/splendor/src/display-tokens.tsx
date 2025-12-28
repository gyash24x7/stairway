import { Button } from "@s2h-ui/primitives/button";
import { MinusIcon, PlusIcon } from "@s2h-ui/primitives/icons";
import { cn } from "@s2h-ui/primitives/utils";
import type { Gem } from "@s2h/splendor/types";
import { useStore } from "@tanstack/react-store";
import { store } from "./store.tsx";

export const gemColors: Record<Gem, string> = {
	diamond: "bg-white text-neutral-dark",
	onyx: "bg-neutral-dark text-white",
	ruby: "bg-apple",
	sapphire: "bg-blueberry",
	emerald: "bg-kiwi",
	gold: "bg-mango"
};

export function DisplayToken( { gem, count }: { gem: Gem; count: number } ) {
	const playerId = useStore( store, state => state.playerId );
	const currentTurn = useStore( store, state => state.currentTurn );
	const isPlayerTurn = playerId === currentTurn;

	return (
		<div className={ cn( "flex items-center gap-2 rounded border-2 p-2", gemColors[ gem as Gem ] ) }>
			<img src={ `/splendor/tokens/${ gem }.svg` } alt={ "gem" } className={ "h-10" }/>
			<Button
				disabled={ !isPlayerTurn }
				size={ "smallIcon" }
				className={ cn( "flex justify-center items-center overflow-hidden" ) }
			>
				<MinusIcon/>
			</Button>
			<div
				className={ "font-bold w-8 h-8 flex items-center justify-center bg-gray-400 rounded-md border-2 flex-1" }>
				{ count }
			</div>
			<Button
				size={ "smallIcon" }
				disabled={ !isPlayerTurn }
				className={ cn( "flex justify-center items-center overflow-hidden" ) }
			>
				<PlusIcon/>
			</Button>
		</div>
	);
}

export function DisplayTokens() {
	const tokens = useStore( store, state => state.tokens );
	return (
		<div className={ `flex flex-col gap-2 bg-background p-2 rounded-md border-2` }>
			{ Object.keys( tokens )
				.map( g => g as Gem )
				.map( gem => <DisplayToken gem={ gem } count={ tokens[ gem ] } key={ gem }/> ) }
		</div>
	);
}