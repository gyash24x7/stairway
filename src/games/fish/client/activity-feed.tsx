"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { useFish } from "@/games/fish/client/context.tsx";
import {
	getAskDescription,
	getClaimDescription,
	getTransferDescription
} from "@/games/fish/shared/utils.ts";
import {
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { SPRING } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { FishMove } from "@/games/fish/shared/schema.ts";
import type { Roster } from "@/swish/shared/schema.ts";

const INLINE_COUNT = 5;
const DRAWER_COUNT = 30;

type Described = {
	key: string;
	description: string;
	success?: boolean;
	transfer?: boolean;
};

/**
 * One move as a line of commentary.
 *
 * @param move - The move to describe.
 * @param index - Its place in the history, which is what keys it.
 * @param players - The roster, for names.
 * @param bookType - The variant, for how a book reads.
 * @returns The described entry.
 */
const describe = (
	move: FishMove,
	index: number,
	players: Roster,
	bookType: Parameters<typeof getClaimDescription>[ 2 ]
) => {
	const key = `move-${ index }`;

	switch ( move._tag ) {
		case "fish/Ask":
			return {
				key,
				description: getAskDescription( move, players ),
				success: move.success
			} satisfies Described;

		case "fish/Claim":
			return {
				key,
				description: getClaimDescription( move, players, bookType ),
				success: move.success
			} satisfies Described;

		case "fish/Transfer":
			return {
				key,
				description: getTransferDescription( move, players ),
				transfer: true
			} satisfies Described;
	}
};

/**
 * What has happened at the table, newest first.
 *
 * One list because the state keeps one list: asks, declarations and transfers
 * share a history now, so the order shown is the order they happened rather than
 * three lists a client had to present apart because it could not interleave them.
 */
export function ActivityFeed() {
	const { data } = useFish();
	const [ showDialog, setShowDialog ] = useState( false );

	const entries = data.view.moves
		.map( ( move, index ) => describe( move, index, data.players, data.config.type ) )
		.reverse();

	if ( entries.length === 0 ) {
		return null;
	}

	return (
		<div className={ "flex flex-col gap-2 w-full" }>
			<motion.div className={ "flex flex-col gap-1.5" } layout>
				<AnimatePresence initial={ false } mode={ "popLayout" }>
					{ entries.slice( 0, INLINE_COUNT ).map( entry => (
						<FeedItem key={ entry.key } entry={ entry }/>
					) ) }
				</AnimatePresence>
			</motion.div>
			{ entries.length > INLINE_COUNT && (
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
							{ entries.slice( 0, DRAWER_COUNT ).map( entry => (
								<FeedItem key={ entry.key } entry={ entry }/>
							) ) }
						</div>
						<DrawerFooter/>
					</DrawerContent>
				</Drawer>
			) }
		</div>
	);
}

function FeedItem( { entry }: { entry: Described } ) {
	return (
		<motion.div
			layout
			initial={ { opacity: 0, scale: 0.7 } }
			animate={ {
				opacity: 1,
				scale: 1,
				transition: SPRING
			} }
			exit={ { opacity: 0, scale: 0.7, transition: { duration: 0.2 } } }
			className={ cn(
				"p-3 rounded-md text-xs md:text-sm font-semibold text-foreground",
				entry.success === true && "bg-green-500/20 dark:bg-green-500/30",
				entry.success === false && "bg-red-500/20 dark:bg-red-500/30",
				entry.transfer && "bg-blue-500/20 dark:bg-blue-500/30"
			) }
		>
			{ entry.description.toUpperCase() }
		</motion.div>
	);
}
