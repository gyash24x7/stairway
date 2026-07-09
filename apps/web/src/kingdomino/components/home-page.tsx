import { client } from "@s2h/client";
import { KingdominoCreateGame as CreateGame } from "@/kingdomino/components/create-game";
import { JoinGame } from "@/shared/components/join-game";
import { useAuth } from "@/shared/hooks/use-auth";
import { Separator } from "@/shared/primitives/separator";
import { cn } from "@s2h/shared/utils/cn";

export function KingdominoHomePage() {
	const { authInfo } = useAuth();
	return (
		<div className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl" }>
			<h2 className={ cn( "text-4xl font-heading" ) }>KINGDOMINO</h2>
			<p>
				Kingdomino is a card game for multiple players in teams or individually using
				a shortened/standard version of the standard 52-card pack. Their are 2
				prominent variants Normal Kingdomino and Canadian Kingdomino.
			</p>
			<Separator/>
			{ !!authInfo
				? (
					<div className={ "grid grid-cols-1 md:grid-cols-2 gap-5 w-full" }>
						<CreateGame/>
						<JoinGame
							game={ "kingdomino" }
							joinGame={ input => client.kingdomino.joinGame( input ) }
						/>
					</div>
				)
				: (
					<div className={ "flex gap-5 w-full" }>
						<div className={ "text-lg text-center" }>Please log in to play.</div>
					</div>
				)
			}
			<Separator/>
		</div>
	);
}
