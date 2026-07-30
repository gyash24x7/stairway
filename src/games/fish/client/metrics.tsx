import type { PlayerId } from "@/shared/swish/schema";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/shared/ui/primitives/table";
import { useFish } from "./context";

export function GameMetrics() {
	const { data } = useFish();
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
					{ Object.entries( data.view.playerData ).map( ( [ id, { metrics } ] ) => (
						<TableRow key={ id } className={ "font-semibold" }>
							<TableCell>{ data.players[ id as PlayerId ].name }</TableCell>
							<TableCell className={ "text-center" }>{ metrics.totalAsks }</TableCell>
							<TableCell className={ "text-center" }>{ metrics.cardsTaken }</TableCell>
							<TableCell className={ "text-center" }>{ metrics.cardsGiven }</TableCell>
							<TableCell className={ "text-center" }>{ metrics.totalClaims }</TableCell>
							<TableCell className={ "text-center" }>{ metrics.successfulClaims }</TableCell>
							<TableCell className={ "text-center" }>
								{ metrics.totalAsks !== 0
									? `${ Math.floor( metrics.cardsTaken / metrics.totalAsks * 100 ) } %`
									: "-"
								}
							</TableCell>
							<TableCell className={ "text-center" }>
								{ metrics.totalClaims !== 0
									? `${ Math.floor( metrics.successfulClaims / metrics.totalClaims * 100 ) } %`
									: "-"
								}
							</TableCell>
						</TableRow>
					) ) }
				</TableBody>
			</Table>
		</div>
	);
}