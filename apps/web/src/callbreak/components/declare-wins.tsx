"use client";

import { useCallbreak } from "@/callbreak/components/context";
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
import { cn } from "@/shared/utils/cn";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useCounter } from "usehooks-ts";

export function DeclareWins() {
	const [ open, setOpen ] = useState( false );
	const { count: wins, increment, decrement, reset } = useCounter( 2 );
	const { shared, declareWins } = useCallbreak();
	const isPending = declareWins.isPending;

	const handleClick = async () => {
		await declareWins.mutateAsync( {
			dealId: shared.state.activeDeal?.id!,
			gameId: shared.id,
			wins
		} );

		reset();
		setOpen( false );
	};

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<Button className={ "w-full max-w-lg" } onClick={ () => setOpen( true ) }>
				DECLARE DEAL WINS
			</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>DECLARE DEAL WINS</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "flex flex-col gap-3 px-4" }>
					<div className="flex justify-center items-center space-x-2">
						<Button size="icon" onClick={ decrement } disabled={ wins <= 2 }>
							<MinusIcon className="h-4 w-4"/>
						</Button>
						<div
							className={ cn(
								"flex-1 h-8 md:h-10 border bg-surface text-sm",
								"flex items-center justify-center rounded-md"
							) }
						>
							{ wins }
						</div>
						<Button size="icon" onClick={ increment } disabled={ wins >= 13 }>
							<PlusIcon className="h-4 w-4"/>
						</Button>
					</div>
				</div>
				<DrawerFooter>
					<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "DECLARE WINS" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
