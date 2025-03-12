import {
	Button,
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "@base/components";
import { MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { useCurrentDealId, useGameId } from "@callbreak/store";
import { useState } from "react";
import { useCounter } from "usehooks-ts";
import { DeclareDealWins } from "./game-actions";


export function DeclareDealWinsDrawer() {
	const gameId = useGameId();
	const dealId = useCurrentDealId();
	const [ open, setOpen ] = useState( false );
	const { count, increment, decrement, reset } = useCounter( 2 );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<DrawerTrigger asChild>
				<Button className={ "flex-1 max-w-lg" }>DECLARE DEAL WINS</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle>Declare Deal Wins</DrawerTitle>
					</DrawerHeader>
					<div className={ "flex flex-col gap-3" }>
						<div className="flex justify-center items-center space-x-2">
							<Button variant="secondary" size="icon" onClick={ increment } disabled={ count <= 2 }>
								<MinusIcon className="h-4 w-4"/>
							</Button>
							<div className="w-20 h-10 flex items-center justify-center border bg-background text-sm">
								{ count }
							</div>
							<Button variant="secondary" size="icon" onClick={ decrement } disabled={ count >= 13 }>
								<PlusIcon className="h-4 w-4"/>
							</Button>
						</div>
					</div>
					<DrawerFooter>
						<DeclareDealWins
							gameId={ gameId }
							dealId={ dealId! }
							wins={ count }
							onSubmit={ () => {
								reset();
								setOpen( false );
							} }
						/>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}