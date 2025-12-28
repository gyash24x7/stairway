import { useStore } from "@tanstack/react-store";
import { DisplayCard, DisplayCardBack } from "./display-card.tsx";
import { store } from "./store.tsx";

export function DisplayBoard() {
	const cards = useStore( store, state => state.cards );
	return (
		<div
			className={ "grid grid-cols-5 gap-2 bg-background p-2 border-2 rounded-md content-between justify-items-center flex-1" }>
			<DisplayCardBack level={ 3 }/>
			{ cards[ 3 ].map( card => !card ? <div/> : <DisplayCard card={ card } key={ card.id }/> ) }
			<DisplayCardBack level={ 2 }/>
			{ cards[ 2 ].map( card => !card ? <div/> : <DisplayCard card={ card } key={ card.id }/> ) }
			<DisplayCardBack level={ 1 }/>
			{ cards[ 1 ].map( card => !card ? <div/> : <DisplayCard card={ card } key={ card.id }/> ) }
		</div>
	);
}