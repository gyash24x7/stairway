import {
	Button,
	cn,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@base/components";
import { DisplayCardSuit } from "@main/components";
import { CARD_SUITS, CardSuit } from "@stairway/cards";
import { useState } from "react";
import { CreateGame } from "./game-actions.tsx";

export function CreateGameDialog() {
	const [ selectedSuit, setSelectedSuit ] = useState<CardSuit>();
	const [ dealCount, setDealCount ] = useState<5 | 9 | 13>();
	const [ open, setOpen ] = useState( false );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger asChild>
				<Button className={ "flex-1 max-w-lg" }>CREATE GAME</Button>
			</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>Create Game</DialogTitle>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<h2>Select Trump Suit</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ CARD_SUITS.map( ( item ) => (
							<div
								key={ item }
								onClick={ () => setSelectedSuit( selectedSuit === item ? undefined : item ) }
								className={ cn(
									selectedSuit === item ? "bg-accent" : "bg-background",
									"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center"
								) }
							>
								<DisplayCardSuit suit={ item }/>
							</div>
						) ) }
					</div>
					<h2>Select Number of Deals</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ [ 5 as const, 9 as const, 13 as const ].map( ( item ) => (
							<div
								key={ item }
								onClick={ () => setDealCount( dealCount === item ? undefined : item ) }
								className={ cn(
									dealCount === item ? "bg-accent" : "bg-background",
									"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center"
								) }
							>
								{ item }
							</div>
						) ) }
					</div>
				</div>
				<DialogFooter>
					<CreateGame trumpSuit={ selectedSuit! } dealCount={ dealCount }/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}