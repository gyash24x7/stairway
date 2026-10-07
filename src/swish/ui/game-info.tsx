import { cn } from "cn";
import { CheckIcon, CopyIcon, MenuIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router";
import { useCopyToClipboard } from "usehooks-ts";

import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { Logo } from "@/shared/shell/logo";
import type { GameId, Roster } from "@/swish/schema";
import { RPlayerInfoSmall } from "@/swish/ui/player-info";
import { TurnTimer } from "@/swish/ui/turn-timer";


type GameInfoProps = {
	id: GameId;
	name: string;
	additionalInfo?: ReactNode;
	spectators?: Roster;
	deadline?: number;
	completed?: boolean;
	showChat?: boolean;
	couchSupport?: boolean;
};

const couchLink = ( game: string, gameId: GameId ) => `/${ game }/${ gameId }/couch`;
const controllerLink = ( game: string, gameId: GameId ) => `/${ game }/${ gameId }/controller`;
const joinLink = ( game: string, gameId: GameId ) => `/${ game }/${ gameId }/join`;

/** How many faces fit beside the game's name before the bar starts to crowd. */
const SHOWN_WATCHERS = 4;

/**
 * The audience, rendered as quietly as it can be and still be there.
 *
 * Overlapped avatars with no names, because a spectator is not a participant:
 * the seats are the thing being read on this screen, and a watcher who took up
 * as much room as a player would be claiming a place at a table they are not
 * sitting at. The names are still reachable — they are in the `title`, and the
 * drawer spells them out in full on the screens too narrow for this.
 *
 * Renders nothing at all when nobody is watching, so a game that never had an
 * audience never shows an empty label for one.
 */
function WatchingStrip( { spectators }: { spectators: Roster } ) {
	const watchers = Object.values( spectators );
	if ( watchers.length === 0 ) {
		return null;
	}

	const shown = watchers.slice( 0, SHOWN_WATCHERS );
	const extra = watchers.length - shown.length;

	return (
		<div
			className={ "flex flex-col gap-2 min-w-0" }
			title={ `Watching: ${ watchers.map( w => w.name ).join( ", " ) }` }
		>
			<p className={ "text-metric-label shrink-0" }>WATCHING</p>
			<div className={ "flex items-center -space-x-2" }>
				{ shown.map( watcher => (
					<Avatar
						key={ watcher.id }
						className={ "rounded-full w-6 h-6 md:w-7 md:h-7 border-outline" }
					>
						<AvatarImage src={ watcher.avatar } alt={ "" } className={ "bg-background" }/>
					</Avatar>
				) ) }
			</div>
			{ extra > 0 && (
				<p className={ "text-metric-label shrink-0" }>+{ extra }</p>
			) }
		</div>
	);
}

export function GameInfo( props: GameInfoProps ) {
	const [ _, copy ] = useCopyToClipboard();
	const [ infoOpen, setInfoOpen ] = useState( false );
	const [ copied, setCopied ] = useState( false );

	const Icon = copied ? CheckIcon : CopyIcon;

	// The bar hides everything but the buttons below `md`, so the drawer is the
	// only way at any of it on a phone. It has to open for an audience too, not
	// just for `additionalInfo`, or a game that carries no stats would leave the
	// watchers with nowhere to be read.
	const watchers = Object.values( props.spectators ?? {} );
	const hasDrawer = !!props.additionalInfo || watchers.length > 0;

	useEffect( () => {
		if ( !copied ) {
			return;
		}
		const timeout = setTimeout( () => setCopied( false ), 1500 );
		return () => clearTimeout( timeout );
	}, [ copied ] );

	/**
	 * Puts the invite on the clipboard.
	 *
	 * The join link and not the game id, because the id on its own is only half
	 * an invitation — there is nowhere to type it — and not the current URL
	 * either, since that is the table itself: somebody who has not joined yet
	 * would land on a board with no way onto it. `/join` is the one address that
	 * knows how to ask. Absolute, because this is going into a message to
	 * somebody else.
	 *
	 * Copied whatever state the game is in. A link to a table that has since
	 * filled up is not worth suppressing a button over — the join page explains
	 * itself — and a control that vanishes mid-game reads as a fault.
	 */
	const handleCopy = () => {
		const link = new URL(
			joinLink( props.name.toLowerCase(), props.id ),
			window.location.origin
		).href;

		copy( link )
			.then( () => setCopied( true ) )
			.catch( error => {
				console.error( "Failed to copy!", error );
			} );
	};

	return (
		<Fragment>
			<div className={ "flex gap-2 rounded-md bg-background w-full h-16 md:h-20" }>
				<div className={ "flex gap-2 items-center bg-accent px-4 py-2 rounded-l-md" }>
					<Logo
						url={ `/logos/${ props.name.toLowerCase() }.svg` }
						classname={ "bg-neutral-dark w-9 h-9" }
					/>
					<h2 className={ "text-3xl font-title text-neutral-dark hidden md:block" }>
						{ props.name.toUpperCase() }
					</h2>
				</div>
				<div className={ "flex-1 flex items-center gap-4 min-w-0" }>
					{ props.additionalInfo && (
						<div className={ "hidden md:flex items-center min-w-0" }>
							{ props.additionalInfo }
						</div>
					) }
					{ !!props.spectators && (
						<div className={ "hidden md:flex items-center min-w-0" }>
							<WatchingStrip spectators={ props.spectators }/>
						</div>
					) }
				</div>
				<div className={ "p-2 flex justify-end gap-2 items-center" }>
					<TurnTimer deadline={ props.deadline } className={ "shrink-0 pr-2" }/>
					{ hasDrawer && (
						<Button
							onClick={ () => setInfoOpen( true ) }
							size={ "icon" }
							className={ "w-8 h-8 md:hidden" }
						>
							<MenuIcon className={ "w-4 h-4" }/>
						</Button>
					) }
					{ !!props.couchSupport && (
						<div className={ "hidden md:flex gap-2 items-center" }>
							<Link
								to={ couchLink( props.name, props.id ) }
								title={ "Show the board on a TV" }
							>
								<Button size={ "icon" } className={ "flex gap-2 items-center" }>
									<MonitorIcon className={ "w-4 h-4 md:w-6 md:h-6" }/>
								</Button>
							</Link>
							<Link
								to={ controllerLink( props.name, props.id ) }
								title={ "Use this device as a controller" }
							>
								<Button size={ "icon" } className={ "flex gap-2 items-center" }>
									<SmartphoneIcon className={ "w-4 h-4 md:w-6 md:h-6" }/>
								</Button>
							</Link>
						</div>
					) }
					<Button
						onClick={ handleCopy }
						size={ "icon" }
						title={ copied ? "Invite link copied" : "Copy the invite link" }
						className={ "w-8 h-8 md:h-10 md:w-10" }
					>
						<Icon className={ "w-4 h-4 md:h-6 md:w-6" }/>
					</Button>
				</div>
			</div>
			<Drawer open={ infoOpen } onOpenChange={ setInfoOpen }>
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>{ props.name.toUpperCase() } INFO</DrawerTitle>
						<DrawerDescription/>
					</DrawerHeader>
					<div className={ "px-4 pb-6 w-full flex flex-col gap-4 overflow-y-scroll max-h-100" }>
						{ !!props.additionalInfo && (
							<div className={ "flex gap-2 flex-wrap items-center" }>
								{ props.additionalInfo }
							</div>
						) }
						{ watchers.length > 0 && (
							<div className={ "flex flex-col gap-1" }>
								<p className={ "text-metric-label" }>WATCHING</p>
								<div className={ "flex gap-2 flex-wrap items-center" }>
									{ watchers.map( watcher => (
										<RPlayerInfoSmall key={ watcher.id } player={ watcher }/>
									) ) }
								</div>
							</div>
						) }
						{ !!props.couchSupport && (
							<div className={ "flex gap-2 flex-wrap items-center justify-center" }>
								<Link
									to={ couchLink( props.name, props.id ) }
									title={ "Show the board on a TV" }
								>
									<Button size={ "sm" } className={ "flex gap-2 items-center" }>
										<MonitorIcon className={ "w-4 h-4 md:w-6 md:h-6" }/>
										<span>SHOW ON TV</span>
									</Button>
								</Link>
								<Link
									to={ controllerLink( props.name, props.id ) }
									title={ "Use this device as a controller" }
								>
									<Button size={ "sm" } className={ "flex gap-2 items-center" }>
										<SmartphoneIcon className={ "w-4 h-4 md:w-6 md:h-6" }/>
										<span>CONTROLLER</span>
									</Button>
								</Link>
							</div>
						) }
					</div>
				</DrawerContent>
			</Drawer>
			{ props.completed && (
				<div
					className={ cn(
						"rounded-md bg-background border-2 border-outline w-full",
						"py-2 text-center"
					) }
				>
					<p className={ "text-status text-muted-foreground" }>GAME OVER</p>
				</div>
			) }
		</Fragment>
	);
}
