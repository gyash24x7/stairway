import {
	Button,
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
	Slider
} from "@base/components";
import { useDealId, useGameId } from "@callbreak/store";
import { useState } from "react";
import { DeclareDealWins } from "./game-actions.tsx";


export function DeclareDealWinsDrawer() {
	const gameId = useGameId();
	const dealId = useDealId();
	const [ wins, setWins ] = useState( 2 );
	const [ open, setOpen ] = useState( false );

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
						<Slider
							defaultValue={ [ 2 ] }
							min={ 2 }
							max={ 13 }
							step={ 1 }
							onValueCommit={ value => setWins( value[ 0 ]! ) }
						/>
						<div className={ "flex justify-between text-xl font-bold" }>
							<div>2</div>
							<div>{ wins }</div>
							<div>13</div>
						</div>
					</div>
					<DrawerFooter>
						<DeclareDealWins
							gameId={ gameId }
							dealId={ dealId! }
							wins={ wins }
							onSubmit={ () => setOpen( false ) }
						/>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}