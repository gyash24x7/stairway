import { Button } from "@s2h-ui/primitives/button";
import { MinusIcon, PlusIcon } from "@s2h-ui/primitives/icons";
import { cn } from "@s2h-ui/primitives/utils";
import { useStore } from "@tanstack/react-store";
import { store } from "./store.tsx";


export function DisplayNobles() {
	const tokens = useStore( store, state => state.tokens );
	return (
		<div className={ `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-background p-2 rounded-md border-2` }>
			{ Object.keys( tokens ).map( gem => (
				<div key={ gem }
					 className={ cn( "flex items-center gap-2 rounded border-2 p-2" ) }>
					<img src={ `/splendor/tokens/${ gem }.svg` } alt={ "gem" } className={ "w-10" }/>
					<Button
						size={ "smallIcon" }
						className={ cn(
							"flex justify-center items-center overflow-hidden"
						) }
					>
						<MinusIcon/>
					</Button>
					<div
						className={ "font-bold w-8 h-8 flex items-center justify-center bg-gray-400 rounded-md border-2" }>
						{ tokens[ gem as keyof typeof tokens ] }
					</div>
					<Button
						size={ "smallIcon" }
						className={ cn(
							"flex justify-center items-center overflow-hidden"
						) }
					>
						<PlusIcon/>
					</Button>
				</div>
			) ) }
		</div>
	);
}