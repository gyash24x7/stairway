"use client";

import { CounterTween } from "@/ui/components/counter-tween";
import { Avatar, AvatarImage } from "@/ui/primitives/avatar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/ui/primitives/table";
import { useCallbreak } from "./context";

export function Scores() {
	const { data } = useCallbreak();
	const deal = data.view.activeDeal;
	return (
		<div className={ "flex flex-col rounded-md bg-background overflow-hidden" }>
			<Table>
				<TableHeader>
					<TableRow className={ "text-md" }>
						<TableHead>PLAYER</TableHead>
						<TableHead className={ "text-center" }>SCORE</TableHead>
						{ data.status !== "COMPLETED" && (
							<TableHead className={ "text-center" }>ACTIVE&nbsp;DEAL</TableHead>
						) }
					</TableRow>
				</TableHeader>
				<TableBody>
					{ data.context.players.map( pid => data.players[ pid ] ).map( ( player ) => (
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
								<CounterTween value={ data.view.scores[ player.id ] ?? 0 }/>
							</TableCell>
							{ data.status !== "COMPLETED" && (
								<TableCell className={ "text-center" }>
									<CounterTween value={ deal?.wins[ player.id ] ?? 0 }/>
									/{ deal?.declarations[ player.id ] ?? 0 }
								</TableCell>
							) }
						</TableRow>
					) ) }
				</TableBody>
			</Table>
		</div>
	);
}
