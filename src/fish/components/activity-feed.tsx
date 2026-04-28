"use client";

import { useFish } from "@/fish/components/context";
import { getAskDescription, getClaimDescription, getTransferDescription } from "@/fish/core/utils";
import {
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { cn } from "@/shared/utils/cn";
import { useState } from "react";

type FeedEntry = {
	type: "ask" | "claim" | "transfer";
	description: string;
	success?: boolean;
	timestamp: number;
};

export function ActivityFeed() {
	const { shared } = useFish();
	const [ showDialog, setShowDialog ] = useState( false );

	const entries: FeedEntry[] = [
		...shared.state.askHistory.map( ask => ( {
			type: "ask" as const,
			description: getAskDescription( ask, shared.players ),
			success: ask.success,
			timestamp: ask.timestamp
		} ) ),

		...shared.state.claimHistory.map( claim => ( {
			type: "claim" as const,
			description: getClaimDescription( claim, shared.players, shared.config.type ),
			success: claim.success,
			timestamp: claim.timestamp
		} ) ),

		...shared.state.transferHistory.map( transfer => ( {
			type: "transfer" as const,
			description: getTransferDescription( transfer, shared.players ),
			timestamp: transfer.timestamp
		} ) )

	].sort( ( a, b ) => b.timestamp - a.timestamp );

	const inlineEntries = entries.slice( 0, 5 );
	const dialogEntries = entries.slice( 0, 10 );

	if ( entries.length === 0 ) {
		return null;
	}

	return (
		<div className={ "flex flex-col gap-2 w-full" }>
			<div className={ "flex flex-col gap-1.5" }>
				{ inlineEntries.map( entry => <FeedItem key={ entry.timestamp } entry={ entry }/> ) }
			</div>
			{ entries.length > 5 && (
				<Drawer open={ showDialog } onOpenChange={ setShowDialog }>
					<button
						onClick={ () => setShowDialog( true ) }
						className={ cn(
							"text-xs md:text-sm text-center",
							"opacity-60 hover:opacity-100 transition-opacity"
						) }
					>
						VIEW MORE ACTIVITY
					</button>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle>GAME ACTIVITY</DrawerTitle>
						</DrawerHeader>
						<div className={ "px-4 flex flex-col gap-1.5 overflow-y-auto" }>
							{ dialogEntries.map( entry => <FeedItem key={ entry.timestamp } entry={ entry }/> ) }
						</div>
						<DrawerFooter/>
					</DrawerContent>
				</Drawer>
			) }
		</div>
	);
}

function FeedItem( { entry }: { entry: FeedEntry } ) {
	return (
		<div
			className={ cn(
				"p-3 rounded-md text-xs md:text-sm font-semibold text-foreground",
				entry.success === true && "bg-green-500/20 dark:bg-green-500/30",
				entry.success === false && "bg-red-500/20 dark:bg-red-500/30",
				entry.type === "transfer" && "bg-blue-500/20 dark:bg-blue-500/30"
			) }
		>
			{ entry.description.toUpperCase() }
		</div>
	);
}
