import { Avatar, AvatarImage, Table, TableBody, TableCell, TableRow } from "@base/components";
import { useDeal, useGameStatus, usePlayerList, useScoresAggregate } from "@callbreak/store";

export function DisplayScore() {
	const playerList = usePlayerList();
	const deal = useDeal();
	const scores = useScoresAggregate();
	const gameStatus = useGameStatus();

	return (
		<div className={ "grid grid-cols-2 gap-3" }>
			{ gameStatus === "IN_PROGRESS" && (
				<div className={ "flex flex-col gap-3 rounded-md p-3 border-2" }>
					<p className={ "text-sm" }>Game Score</p>
					<Table>
						<TableBody>
							{ playerList.map( ( player ) => (
								<TableRow key={ player.id } className={ "font-semibold" }>
									<TableCell className={ "flex gap-2 items-center" }>
										<Avatar className={ "rounded-full w-7 h-7 hidden sm:block" }>
											<AvatarImage src={ player.avatar } alt={ "" }/>
										</Avatar>
										<h2 className={ "font-semibold" }>{ player.name }</h2>
									</TableCell>
									<TableCell className={ "text-center" }>
										{ scores[ player.id ] ?? 0 }
									</TableCell>
								</TableRow>
							) ) }
						</TableBody>
					</Table>
				</div>
			) }
			{ gameStatus === "IN_PROGRESS" && (
				<div className={ "flex flex-col gap-3 rounded-md p-3 border-2" }>
					<p className={ "text-sm" }>Deal Score</p>
					<Table>
						<TableBody>
							{ playerList.map( ( player ) => (
								<TableRow key={ player.id } className={ "font-semibold" }>
									<TableCell className={ "flex gap-2 items-center" }>
										<Avatar className={ "rounded-full w-7 h-7 hidden sm:block" }>
											<AvatarImage src={ player.avatar } alt={ "" }/>
										</Avatar>
										<h2 className={ "font-semibold" }>{ player.name }</h2>
									</TableCell>
									<TableCell className={ "text-center" }>
										{ deal?.wins[ player.id ] ??
											0 }&nbsp;/&nbsp;{ deal?.declarations[ player.id ] ?? 0 }
									</TableCell>
								</TableRow>
							) ) }
						</TableBody>
					</Table>
				</div>
			) }
		</div>
	);
}