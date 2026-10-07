import type { FishConfig, FishView } from "@/games/fish/schema";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/shared/primitives/table";
import type { GameView } from "@/swish/schema";


const percent = ( part: number, whole: number ) =>
	whole === 0 ? "-" : `${ Math.floor( part / whole * 100 ) } %`;

export type GameMetricsProps = {
	readonly game: GameView<FishView, FishConfig>;
};

/**
 * How every seat played. The engine only fills `metrics` once the last book has
 * been declared — it is an end-of-game summary, and the histories it is folded
 * from are there to read in the meantime — so this renders nothing before then.
 */
export function GameMetrics( { game }: GameMetricsProps ) {
	const metrics = game.view.metrics;

	if ( !metrics ) {
		return null;
	}

	return (
		<div className={ "w-full overflow-scroll" }>
			<Table>
				<TableHeader>
					<TableRow className={ "font-semibold" }>
						<TableHead>Player</TableHead>
						<TableHead className={ "text-center" }>Total Asks</TableHead>
						<TableHead className={ "text-center" }>Cards Taken</TableHead>
						<TableHead className={ "text-center" }>Cards Given</TableHead>
						<TableHead className={ "text-center" }>Total Claims</TableHead>
						<TableHead className={ "text-center" }>Successful Claims</TableHead>
						<TableHead className={ "text-center" }>Ask Accuracy</TableHead>
						<TableHead className={ "text-center" }>Call Accuracy</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{ game.context.players.map( playerId => {
						const seat = metrics[ playerId ];
						if ( !seat ) {
							return null;
						}

						return (
							<TableRow key={ playerId } className={ "font-semibold" }>
								<TableCell>{ game.players[ playerId ]?.name }</TableCell>
								<TableCell className={ "text-center" }>{ seat.totalAsks }</TableCell>
								<TableCell className={ "text-center" }>{ seat.cardsTaken }</TableCell>
								<TableCell className={ "text-center" }>{ seat.cardsGiven }</TableCell>
								<TableCell className={ "text-center" }>{ seat.totalClaims }</TableCell>
								<TableCell className={ "text-center" }>{ seat.successfulClaims }</TableCell>
								<TableCell className={ "text-center" }>
									{ percent( seat.cardsTaken, seat.totalAsks ) }
								</TableCell>
								<TableCell className={ "text-center" }>
									{ percent( seat.successfulClaims, seat.totalClaims ) }
								</TableCell>
							</TableRow>
						);
					} ) }
				</TableBody>
			</Table>
		</div>
	);
}
