import { useAuth } from "@/auth/components/context";
import { JoinGame } from "@/shared/components/join-game";
import { Separator } from "@/shared/primitives/separator";
import { cn } from "@/shared/utils/cn";
import { SplendorCreateGame as CreateGame } from "@/splendor/components/create-game";
import { joinGame } from "@/splendor/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/splendor/" )( {
	component: () => {
		const { authInfo } = useAuth();

		return (
			<div className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl justify-self-center" }>
				<h2 className={ cn( "text-4xl font-heading" ) }>SPLENDOR</h2>
				<p>
					Splendor is a strategy game where players collect gems to purchase
					development cards and attract nobles. Build your gem empire and be the
					first to reach 15 prestige points to win.
				</p>
				<p>
					Supports 2 to 4 players. Create a game and share the code with
					friends to play together.
				</p>
				<Separator/>
				{ !!authInfo
					? (
						<div className={ "flex gap-5 justify-self-center w-full" }>
							<CreateGame/>
							<JoinGame game={ "splendor" } joinGame={ joinGame }/>
						</div>
					)
					: (
						<div className={ "flex gap-5 justify-self-center w-full" }>
							<div className={ "text-lg text-center" }>Please log in to play.</div>
						</div>
					)
				}
				<Separator/>
			</div>
		);
	}
} );
