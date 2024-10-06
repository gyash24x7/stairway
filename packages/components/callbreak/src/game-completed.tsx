import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@base/components";
import { usePlayers, useScoreList } from "@callbreak/store";

export function GameCompleted() {
	const players = usePlayers();
	const scoreList = useScoreList();
	const playerList = Object.values( players );

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
							{ playerList.map( player => (
								<TableHead className={ "text-center" } key={ player.id }>{ player.name }</TableHead>
							) ) }
						</TableRow>
					</TableHeader>
					<TableBody>
						{ scoreList.map( ( scores, index ) => (
							<TableRow key={ index } className={ "font-semibold" }>
								{ playerList.map( player => (
									<TableCell className={ "text-center" } key={ player.id }>
										{ scores[ player.id ] }
									</TableCell>
								) ) }
							</TableRow>
						) ) }
					</TableBody>
				</Table>
			</div>
		</div>
	);
}