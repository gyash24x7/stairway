import { HStack } from "@s2h/ui";

import { useAuth, useGame } from "../utils";
import { DisplayCard } from "./display-card";

export const DisplayHand = () => {
	const { user } = useAuth();
	const { players } = useGame();

	return (
		<div className={ "w-full py-4 lg:py-0" }>
			<h3 className={ "text-xl mb-2 font-semibold" }>Your Hand</h3>
			<HStack wrap spacing={ "sm" } stackItemClassName={ "my-2" }>
				{ players[ user!.id ].hand.sorted().map( card => (
					<DisplayCard card={ card } key={ card.id }/>
				) ) }
			</HStack>
		</div>
	);
};