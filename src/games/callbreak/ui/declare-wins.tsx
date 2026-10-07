import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { cn } from "cn";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useCounter } from "usehooks-ts";

import { CALLBREAK_MIN_DECLARATION, CALLBREAK_TRICKS_PER_DEAL } from "@/games/callbreak/schema";
import { declareWinsAtom } from "@/games/callbreak/ui/client";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { GameId } from "@/swish/schema";

export type DeclareWinsProps = {
	readonly gameId: string;
	readonly dealId?: string;
};

export function DeclareWins( { gameId, dealId }: DeclareWinsProps ) {
	const [ open, setOpen ] = useState( false );
	const { count: wins, increment, decrement, reset } = useCounter( CALLBREAK_MIN_DECLARATION );

	const declare = useAtomSet( declareWinsAtom, { mode: "promiseExit" } );
	const declaring = useAtomValue( declareWinsAtom ).waiting;

	const handleClick = async () => {
		if ( !dealId ) {
			return;
		}

		await declare( {
			params: { gameId: GameId.make( gameId ) },
			payload: { dealId, wins }
		} );

		reset();
		setOpen( false );
	};

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<Button onClick={ () => setOpen( true ) }>
				DECLARE DEAL WINS
			</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>DECLARE DEAL WINS</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "flex flex-col gap-3 px-4 overflow-y-scroll max-h-100" }>
					<div className={ "flex justify-center items-center gap-2" }>
						<Button
							size={ "icon" }
							onClick={ decrement }
							disabled={ wins <= CALLBREAK_MIN_DECLARATION }
						>
							<MinusIcon className={ "h-4 w-4" }/>
						</Button>
						<div
							className={ cn(
								"flex-1 h-8 md:h-10 border bg-surface text-sm",
								"flex items-center justify-center rounded-md"
							) }
						>
							{ wins }
						</div>
						<Button
							size={ "icon" }
							onClick={ increment }
							disabled={ wins >= CALLBREAK_TRICKS_PER_DEAL }
						>
							<PlusIcon className={ "h-4 w-4" }/>
						</Button>
					</div>
				</div>
				<DrawerFooter>
					<Button
						onClick={ () => void handleClick() }
						disabled={ declaring || !dealId }
						className={ "w-full" }
					>
						{ declaring ? <Spinner/> : "DECLARE WINS" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
