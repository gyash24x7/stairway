"use client";

import { useFish } from "@/games/fish/client/context.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/shared/ui/primitives/table.tsx";

const percent = ( part: number, whole: number ) =>
	whole === 0 ? "-" : `${ Math.floor( part / whole * 100 ) } %`;

/**
 * How every seat played. The engine only fills `metrics` once the last book has
 * been declared — it is an end-of-game summary, and the histories it is folded
 * from are there to read in the meantime — so this renders nothing before then.
 */
export function GameMetrics() {
	const { data } = useFish();
	const metrics = data.view.metrics;

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
					{ data.context.players.map( playerId => {
						const seat = metrics[ playerId ];
						if ( !seat ) {
							return null;
						}

						return (
							<TableRow key={ playerId } className={ "font-semibold" }>
								<TableCell>{ data.players[ playerId ]?.name }</TableCell>
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
