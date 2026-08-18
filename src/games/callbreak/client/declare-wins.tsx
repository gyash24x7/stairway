"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useCounter } from "usehooks-ts";

import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import {
	CALLBREAK_MIN_DECLARATION,
	CALLBREAK_TRICKS_PER_DEAL
} from "@/games/callbreak/shared/schema.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

export function DeclareWins() {
	const [ open, setOpen ] = useState( false );
	const { count: wins, increment, decrement, reset } = useCounter( CALLBREAK_MIN_DECLARATION );
	const { data, actions, isPending } = useCallbreak();

	const dealId = data.view.activeDeal?.id;

	const handleClick = () => {
		if ( !dealId ) {
			return;
		}

		actions.declareWins( { dealId, wins } );
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
					<Button onClick={ handleClick } disabled={ isPending || !dealId } className={ "w-full" }>
						{ isPending ? <Spinner/> : "DECLARE WINS" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
