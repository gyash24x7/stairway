import { Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@base/components";
import { useGameId, usePlayers } from "@literature/store";
import { client } from "@stairway/clients/literature";
import { useQuery } from "@tanstack/react-query";

export function GameCompleted() {
	const gameId = useGameId();
	const players = usePlayers();

	const { data, isPending } = useQuery( {
		queryKey: [ "metrics", gameId ],
		queryFn: () => client.getMetrics.query( { gameId } )
	} );

	if ( isPending || !data ) {
		return <Spinner/>;
	}

	return (
		<div className={ "flex flex-col gap-3" }>
			<div className={ "border-2 rounded-md bg-green-200" }>
				<p className={ "font-semibold lg:text-6xl text-4xl text-center p-3" }>
					Game&nbsp;Completed
				</p>
			</div>
			<div className={ "p-3 border-2 rounded-md flex flex-col gap-3 justify-center items-center" }>
				<p className={ "font-semibold lg:text-4xl text-2xl" }>Metrics</p>
				<Table>
					<TableHeader>
						<TableRow className={ "font-semibold" }>
							<TableHead>Player</TableHead>
							<TableHead className={ "text-center" }>Total Asks</TableHead>
							<TableHead className={ "text-center" }>Successful Asks</TableHead>
							<TableHead className={ "text-center" }>Total Calls</TableHead>
							<TableHead className={ "text-center" }>Successful Calls</TableHead>
							<TableHead className={ "text-center" }>Ask Accuracy</TableHead>
							<TableHead className={ "text-center" }>Call Accuracy</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{ data.player.map( ( metrics ) => (
							<TableRow key={ metrics.playerId } className={ "font-semibold" }>
								<TableCell>{ players[ metrics.playerId ].name }</TableCell>
								<TableCell className={ "text-center" }>{ metrics.totalAsks }</TableCell>
								<TableCell className={ "text-center" }>{ metrics.successfulAsks }</TableCell>
								<TableCell className={ "text-center" }>{ metrics.totalCalls }</TableCell>
								<TableCell className={ "text-center" }>{ metrics.successfulCalls }</TableCell>
								<TableCell className={ "text-center" }>
									{ metrics.totalAsks !== 0
										? `${ Math.floor( metrics.successfulAsks / metrics.totalAsks * 100 ) } %`
										: "-"
									}
								</TableCell>
								<TableCell className={ "text-center" }>
									{ metrics.totalCalls !== 0
										? `${ Math.floor( metrics.successfulCalls / metrics.totalCalls * 100 ) } %`
										: "-"
									}
								</TableCell>
							</TableRow>
						) ) }
					</TableBody>
				</Table>
			</div>
		</div>
	);
}