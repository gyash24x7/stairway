import { orpc } from "@s2h/client/query";
import { FishProvider } from "@/fish/components/context";
import { GameView } from "@/fish/components/game-view";
import { Spinner } from "@/shared/primitives/spinner";
import { useQuery } from "@tanstack/react-query";

export function FishGamePage( { gameId }: { gameId: string } ) {
	const { data, isLoading } = useQuery( orpc.fish.getGame.queryOptions( { input: { gameId } } ) );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<FishProvider data={ data }>
			<GameView/>
		</FishProvider>
	);
}
