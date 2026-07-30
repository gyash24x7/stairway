import { useAuth } from "@/auth/client/use-auth";
import { toPlayerInfo } from "@/contract/client";
import { JoinGame } from "@/ui/components/join-game";
import { Separator } from "@/ui/primitives/separator";
import { cn } from "@/ui/utils/cn";
import { joinKingdominoGameFn } from "./client";
import { KingdominoCreateGame as CreateGame } from "./create-game";

export function KingdominoHomePage( props: { isLoggedIn?: boolean } ) {
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
			{ !!props.isLoggedIn
				? (
					<div className={ "grid grid-cols-1 md:grid-cols-2 gap-5 w-full" }>
						<CreateGame/>
						<JoinGame
							game={ "kingdomino" }
							joinGame={ async ( { code } ) => {
								const { id } = await joinKingdominoGameFn( code, toPlayerInfo( authInfo! ) );
								return id;
							} }
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
