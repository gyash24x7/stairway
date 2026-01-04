import { cn } from "@s2h-ui/primitives/utils";
import { useStore } from "@tanstack/react-store";
import { DisplayCard, DisplayCardBack } from "./display-card.tsx";
import { DisplayNoble, DisplayNobleBack } from "./display-noble.tsx";
import { handleSelectedTokenChange, store } from "./store.tsx";
import { TokenPicker } from "./token-picker.tsx";

export function DisplayBoard() {
	const cards = useStore( store, state => state.cards );
	const nobles = useStore( store, state => state.nobles );
	const tokens = useStore( store, state => state.tokens );

	return (
		<div className={ "flex flex-col gap-2" }>
			<div className={ cn( "flex gap-2 items-center justify-between bg-background p-2 border-2 rounded-md" ) }>
				<DisplayNobleBack/>
				{ nobles.map( noble => <DisplayNoble noble={ noble } key={ noble.id }/> ) }
			</div>
			<div className={ "flex flex-col gap-2 bg-background p-2 border-2 rounded-md" }>
				<div className={ "flex gap-2 items-center justify-between w-full" }>
					<DisplayCardBack level={ 3 }/>
					{ cards[ 3 ].map( card => card && <DisplayCard card={ card } key={ card.id }/> ) }
				</div>
				<div className={ "flex gap-2 items-center justify-between w-full" }>
					<DisplayCardBack level={ 2 }/>
					{ cards[ 2 ].map( card => card && <DisplayCard card={ card } key={ card.id }/> ) }
				</div>
				<div className={ "flex gap-2 items-center justify-between w-full" }>
					<DisplayCardBack level={ 1 }/>
					{ cards[ 1 ].map( card => card && <DisplayCard card={ card } key={ card.id }/> ) }
				</div>
			</div>
			<div className={ `flex gap-2 bg-background border-2 rounded-md p-2` }>
				<TokenPicker initialTokens={ tokens } pickLimit={ 3 } onPickChange={ handleSelectedTokenChange }/>
			</div>
		</div>
	);
}