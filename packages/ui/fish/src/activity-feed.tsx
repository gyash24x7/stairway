"use client";

import {
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@s2h/ui/primitives/drawer";
import { cn } from "@s2h/ui/utils/cn";
import { getAskDescription, getClaimDescription, getTransferDescription } from "@s2h/utils/fish";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useFish } from "./context";

type FeedEntry = {
	type: "ask" | "claim" | "transfer";
	description: string;
	success?: boolean;
	timestamp: number;
};

export function ActivityFeed() {
	const { data } = useFish();
	const [ showDialog, setShowDialog ] = useState( false );

	const entries: FeedEntry[] = [
		...data.view.askHistory.map( ask => ( {
			type: "ask" as const,
			description: getAskDescription( ask, data.players ),
			success: ask.success,
			timestamp: ask.timestamp
		} ) ),

		...data.view.claimHistory.map( claim => ( {
			type: "claim" as const,
			description: getClaimDescription( claim, data.players, data.config.type ),
			success: claim.success,
			timestamp: claim.timestamp
		} ) ),

		...data.view.transferHistory.map( transfer => ( {
			type: "transfer" as const,
			description: getTransferDescription( transfer, data.players ),
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
			<motion.div className={ "flex flex-col gap-1.5" } layout>
				<AnimatePresence initial={ false } mode={ "popLayout" }>
					{ inlineEntries.map( entry => <FeedItem key={ entry.timestamp } entry={ entry }/> ) }
				</AnimatePresence>
			</motion.div>
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
						<div className={ "px-4 flex flex-col gap-1.5 overflow-y-scroll max-h-110" }>
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
		<motion.div
			layout
			initial={ { opacity: 0, scale: 0.7 } }
			animate={ {
				opacity: 1,
				scale: 1,
				transition: { type: "spring", stiffness: 380, damping: 22 }
			} }
			exit={ { opacity: 0, scale: 0.7, transition: { duration: 0.2 } } }
			className={ cn(
				"p-3 rounded-md text-xs md:text-sm font-semibold text-foreground",
				entry.success === true && "bg-green-500/20 dark:bg-green-500/30",
				entry.success === false && "bg-red-500/20 dark:bg-red-500/30",
				entry.type === "transfer" && "bg-blue-500/20 dark:bg-blue-500/30"
			) }
		>
			{ entry.description.toUpperCase() }
		</motion.div>
	);
}
