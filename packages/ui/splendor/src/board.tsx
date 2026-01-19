import { cn } from "@s2h-ui/primitives/utils";
import { useStore } from "@tanstack/react-store";
import { CardActions } from "./card-actions.tsx";
import { GameCardBack } from "./game-card.tsx";
import { Noble, NobleBack } from "./noble.tsx";
import { store } from "./store.tsx";

export function Board() {
	const cards = useStore( store, state => state.cards );
	const nobles = useStore( store, state => state.nobles );

	return (
		<div className={ "flex flex-col gap-3 w-full" }>
			<div className={ cn( "flex gap-2 items-center justify-between bg-background p-3 rounded-md" ) }>
				<div className={ "hidden md:block" }>
					<NobleBack/>
				</div>
				{ nobles.map( noble => <Noble noble={ noble } key={ noble.id }/> ) }
			</div>
			<div className={ "flex flex-col gap-2 bg-background p-3 rounded-md" }>
				<div className={ "flex gap-2 items-center justify-between w-full" }>
					<div className={ "hidden md:block" }>
						<GameCardBack level={ 3 }/>
					</div>
					{ cards[ 3 ].map( card => card && <CardActions card={ card } key={ card.id }/> ) }
				</div>
				<div className={ "flex gap-2 items-center justify-between w-full" }>
					<div className={ "hidden md:block" }>
						<GameCardBack level={ 2 }/>
					</div>
					{ cards[ 2 ].map( card => card && <CardActions card={ card } key={ card.id }/> ) }
				</div>
				<div className={ "flex gap-2 items-center justify-between w-full" }>
					<div className={ "hidden md:block" }>
						<GameCardBack level={ 1 }/>
					</div>
					{ cards[ 1 ].map( card => card && <CardActions card={ card } key={ card.id }/> ) }
				</div>
			</div>
		</div>
	);
}