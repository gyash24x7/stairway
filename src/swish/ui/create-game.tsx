import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/shared/primitives/button";
import { RadioSelect } from "@/shared/primitives/radio-select";
import type { GameRef } from "@/swish/schema";


const VISIBILITIES = [ "OPEN", "PRIVATE" ] as const;

type Visibility = typeof VISIBILITIES[ number ];

export type CreateGameOptions = { isPrivate: boolean };

type CreateGameProps = {
	game: string;
	disabled?: boolean;
	createGame: ( options: CreateGameOptions ) => Promise<GameRef>;
	children?: ReactNode;
};

/**
 * The panel every game opens a table from.
 *
 * Visibility lives here rather than in each game's own panel because it is the
 * same question wherever it is asked, and because it is the one setting a
 * creator can get wrong in a way they cannot see: a table left open is offered
 * to strangers, and nothing about the game afterwards would tell them it had
 * been. Asking once, in the one place every game passes through, is what makes
 * that a choice rather than a default nobody was shown.
 *
 * It defaults to OPEN, which is what makes the lobby worth having — a default of
 * PRIVATE would leave it permanently empty — and the line beneath the choice
 * says plainly which one is selected.
 *
 * The choice is handed to `createGame` rather than held here, because the panel
 * does not know which game it is opening: each game builds its own payload, and
 * this is the one field all seven share.
 */
export function CreateGame( {
	game,
	disabled,
	createGame,
	children
}: CreateGameProps ) {
	const navigate = useNavigate();
	const [ isPending, startTransition ] = useTransition();
	const [ visibility, setVisibility ] = useState<Visibility>( "OPEN" );

	const handleCreate = () => startTransition( async () => {
		const ref = await createGame( { isPrivate: visibility === "PRIVATE" } );
		void navigate( `/${ game }/${ ref.gameId }` );
	} );


	return (
		<div className={ "rounded-md bg-background p-6 flex flex-col gap-4 flex-1 max-w-2xl" }>
			<h2 className={ "text-xl font-heading" }>New Game</h2>
			<p className={ "text-sm text-muted-foreground" }>
				Open a table for anyone to join, or keep it to the people you share the code with
			</p>
			{ children }

			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>Table</label>
				<RadioSelect
					options={ VISIBILITIES }
					value={ visibility }
					onChange={ next => setVisibility( next ?? "OPEN" ) }
					allowDeselect={ false }
				/>
				<p className={ "text-xs text-muted-foreground" }>
					{ visibility === "OPEN"
						? "Anyone can find this table and take a seat."
						: "Hidden from the lobby — only people you give the code to can join." }
				</p>
			</div>

			<Button onClick={ handleCreate } disabled={ disabled || isPending }>
				Create Game
			</Button>
		</div>
	);
}
