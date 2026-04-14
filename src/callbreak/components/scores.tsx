"use client";

import { useCallbreak } from "@/callbreak/components/context";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/primitives/table";

export function Scores() {
	const { match } = useCallbreak();
	const deal = match.state.data.activeDeal;
	return (
		<div className={ "flex flex-col rounded-md bg-background overflow-hidden" }>
			<Table>
				<TableHeader>
					<TableRow className={ "text-md" }>
						<TableHead>PLAYER</TableHead>
						<TableHead className={ "text-center" }>SCORE</TableHead>
						{ match.status !== "COMPLETED" && (
							<TableHead className={ "text-center" }>ACTIVE&nbsp;DEAL</TableHead>
						) }
					</TableRow>
				</TableHeader>
				<TableBody>
					{ match.state.ctx.players.map( pid => match.players[ pid ] ).map( ( player ) => (
						<TableRow key={ player.id }>
							<TableCell className={ "flex gap-2 items-center" }>
								<Avatar className={ "rounded-full w-7 h-7 hidden sm:block" }>
									<AvatarImage
										src={ player.avatar }
										alt={ "" }
										className={ "bg-background" }
									/>
								</Avatar>
								<h2 className={ "font-semibold" }>{ player.name.toUpperCase() }</h2>
							</TableCell>
							<TableCell className={ "text-center" }>
								{ match.state.data.scores[ player.id ] }
							</TableCell>
							{ match.status !== "COMPLETED" && (
								<TableCell className={ "text-center" }>
									{ deal?.wins[ player.id ] ?? 0 }/{ deal?.declarations[ player.id ] ?? 0 }
								</TableCell>
							) }
						</TableRow>
					) ) }
				</TableBody>
			</Table>
		</div>
	);
}