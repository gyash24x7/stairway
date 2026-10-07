import { cn } from "cn";

import type { CallbreakConfig, CallbreakView } from "@/games/callbreak/schema";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/shared/primitives/table";
import { CounterTween } from "@/shared/shell/counter-tween";
import type { GameView } from "@/swish/schema";

type Game = GameView<CallbreakView, CallbreakConfig>;

export type ScoresProps = {
	readonly game: Game;
	readonly large?: boolean;
};

export function Scores( { game, large }: ScoresProps ) {
	const deal = game.view.activeDeal;
	const showDeal = game.status !== "COMPLETED";

	return (
		<div
			className={ cn(
				"flex flex-col rounded-md bg-background overflow-hidden",
				large && "rounded-xl h-full"
			) }
		>
			<Table>
				<TableHeader>
					<TableRow className={ cn( "text-base", large && "text-3xl" ) }>
						<TableHead className={ cn( large && "py-6 px-6 text-3xl" ) }>PLAYER</TableHead>
						<TableHead className={ cn( "text-center", large && "py-6 text-3xl" ) }>
							SCORE
						</TableHead>
						{ showDeal && (
							<TableHead className={ cn( "text-center", large && "py-6 px-6 text-3xl" ) }>
								ACTIVE&nbsp;DEAL
							</TableHead>
						) }
					</TableRow>
				</TableHeader>
				<TableBody>
					{ game.context.players.map( playerId => {
						const player = game.players[ playerId ];
						if ( !player ) {
							return null;
						}

						return (
							<TableRow key={ playerId }>
								<TableCell
									className={ cn( "flex gap-2 items-center", large && "gap-4 py-6 px-6" ) }>
									<Avatar
										className={ cn(
											"rounded-full w-7 h-7 hidden sm:block",
											large && "w-16 h-16 block"
										) }
									>
										<AvatarImage src={ player.avatar } alt={ "" } className={ "bg-background" }/>
									</Avatar>
									<h2 className={ cn( "font-semibold", large && "text-4xl font-heading" ) }>
										{ player.name.toUpperCase() }
									</h2>
								</TableCell>
								<TableCell className={ cn( "text-center", large && "text-5xl py-6 font-heading" ) }>
									<CounterTween value={ game.view.scores[ playerId ] ?? 0 }/>
								</TableCell>
								{ showDeal && (
									<TableCell
										className={ cn( "text-center", large && "text-5xl py-6 px-6 font-heading" ) }
									>
										<CounterTween value={ deal?.wins[ playerId ] ?? 0 }/>
										/{ deal?.declarations[ playerId ] ?? 0 }
									</TableCell>
								) }
							</TableRow>
						);
					} ) }
				</TableBody>
			</Table>
		</div>
	);
}
