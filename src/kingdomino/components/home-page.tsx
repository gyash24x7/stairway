import { KingdominoCreateGame as CreateGame } from "@/kingdomino/components/create-game";
import { joinGame } from "@/kingdomino/core/actions";
import { JoinGame } from "@/shared/components/join-game";
import { Separator } from "@/shared/primitives/separator";
import { cn } from "@/shared/utils/cn";
import { requestInfo } from "rwsdk/worker";

export function KingdominoHomePage() {
	return (
		<div className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl" }>
			<h2 className={ cn( "text-4xl font-heading" ) }>KINGDOMINO</h2>
			<p>
				Kingdomino is a card game for multiple players in teams or individually using
				a shortened/standard version of the standard 52-card pack. Their are 2
				prominent variants Normal Kingdomino and Canadian Kingdomino.
			</p>
			<Separator/>
			{ !!requestInfo.ctx.authInfo
				? (
					<div className={ "flex gap-5 w-full" }>
						<CreateGame/>
						<JoinGame game={ "kingdomino" } joinGame={ joinGame }/>
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
