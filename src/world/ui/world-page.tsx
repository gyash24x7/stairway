import { cn } from "cn";
import { ArrowLeftIcon, RefreshCwIcon, UsersIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useMatch, useNavigate, useOutlet } from "react-router";

import { RequireSession } from "@/auth/ui/require-session";
import { useAuth } from "@/auth/ui/use-auth";
import type { OpenTable } from "@/lobby/schema";
import { isGameName } from "@/shared/games";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { GamePathProvider } from "@/swish/ui/game-path";
import { tableNear, WORLD } from "@/world/map";
import type { WorldConnection, WorldState } from "@/world/ui/connection";
import { useWorldConnection, useWorldState } from "@/world/ui/connection";
import { ChatBox, HudCard, Key, RoomPanel } from "@/world/ui/hud";
import { usePalette } from "@/world/ui/stage/palette";
import { WorldStage } from "@/world/ui/stage/world-stage";
import { useMovement } from "@/world/ui/use-movement";


const isTyping = ( target: EventTarget | null ) =>
	target instanceof HTMLElement && [ "INPUT", "TEXTAREA", "SELECT" ].includes( target.tagName );

/** Re-renders every second while `active`, so speech bubbles disappear when they expire. */
function useNow( active: boolean ) {
	const [ now, setNow ] = useState( Date.now );
	useEffect( () => {
		if ( !active ) {
			return;
		}
		const timer = setInterval( () => setNow( Date.now() ), 1_000 );
		return () => clearInterval( timer );
	}, [ active ] );
	return now;
}

function EnterSplash( { onEnter }: { onEnter: () => void } ) {
	const me = useAuth();

	return (
		<div className={ "absolute inset-0 flex items-center justify-center p-4" }>
			<HudCard className={ "flex flex-col gap-5 items-center max-w-md w-full p-8 text-center" }>
				<h1 className={ "font-title text-4xl text-accent" }>THE ARENA</h1>
				{ me && (
					<div className={ "flex flex-col items-center gap-2" }>
						<Avatar className={ "w-20 h-20 rounded-full border-2 border-outline" }>
							<AvatarImage src={ me.avatar } alt={ "" } className={ "bg-background" }/>
						</Avatar>
						<p className={ "font-heading text-lg" }>{ me.name }</p>
					</div>
				) }
				<p className={ "text-sm text-muted-foreground" }>
					Walk around, see who is playing, and sit down at a table in any game's room.
				</p>
				<div className={ "flex flex-wrap gap-2 justify-center text-xs items-center" }>
					<Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> or arrows to walk ·
					click to walk · <Key>E</Key> to sit · <Key>Enter</Key> to chat
				</div>
				<Button size={ "lg" } onClick={ onEnter } autoFocus>ENTER</Button>
				<Link to={ "/" } className={ "text-xs underline text-muted-foreground" }>
					Use the classic view
				</Link>
			</HudCard>
		</div>
	);
}

function ConnectionBanner( { state, connection }: {
	state: WorldState;
	connection: WorldConnection;
} ) {
	if ( state.status === "open" || ( state.status === "connecting" && !state.self ) ) {
		return null;
	}

	return (
		<HudCard className={ "absolute top-3 left-1/2 -translate-x-1/2 flex gap-3 items-center" }>
			{ state.status === "failed"
				? (
					<>
						<p className={ "text-sm" }>Lost the connection to the arena.</p>
						<Button size={ "sm" } onClick={ connection.reconnect }>
							<RefreshCwIcon className={ "w-4 h-4" }/> RETRY
						</Button>
					</>
				)
				: (
					<>
						<Spinner/>
						<p className={ "text-sm" }>Reconnecting…</p>
					</>
				) }
		</HudCard>
	);
}

/**
 * The open world: `/world`, with each game's pages nested beneath it as an
 * overlay at `/world/:game`, `/world/:game/:gameId` and `/world/:game/:gameId/join`.
 *
 * The overlay is nested rather than a separate route so the world stays
 * mounted underneath it. The socket stays open and your avatar stays where it
 * stood, and other people see it marked as playing while a table is open.
 * Closing the overlay puts you back in the room you left from.
 */
function World() {
	const navigate = useNavigate();
	const outlet = useOutlet();
	const atTable = useMatch( "/world/:game/:gameId" );
	const overlayOpen = !!outlet;

	// Arriving straight on a table (a reload mid-game, or a link from the
	// lobby) skips the splash. The person already chose where to be, and
	// making them click ENTER first would hide the game they came for.
	const [ entered, setEntered ] = useState( overlayOpen );
	const connection = useWorldConnection( entered );
	const state = useWorldState( connection );
	const palette = usePalette();
	const { walkTo } = useMovement( connection, entered && !overlayOpen );
	const chatRef = useRef<HTMLInputElement>( null );

	// Tagged with the room they were fetched for, so leaving a room drops its
	// tables without an effect having to clear them.
	const [ fetched, setFetched ] = useState<{ game: string; tables: ReadonlyArray<OpenTable> }>();
	const self = state.self;
	const room = self?.room && isGameName( self.room ) ? self.room : undefined;
	const roomTables = fetched && fetched.game === room ? fetched.tables : [];
	const near = self ? tableNear( self.pos ) : undefined;
	const nearTable = near?.room.game ? roomTables[ near.index ] : undefined;

	useEffect( () => {
		connection?.setPlaying( !!atTable );
	}, [ connection, atTable ] );

	/**
	 * Sitting at a table: join the game assigned to that spot, or open a new
	 * one if the spot is empty. A new table goes through the game's own home
	 * page, because each game asks its own setup questions when opening a table.
	 */
	const sit = () => {
		const game = near?.room.game;
		if ( !game ) {
			return;
		}
		void navigate( nearTable ? `/world/${ game }/${ nearTable.gameId }/join` : `/world/${ game }` );
	};

	useEffect( () => {
		if ( !entered || overlayOpen ) {
			return;
		}
		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( isTyping( event.target ) || event.metaKey || event.ctrlKey ) {
				return;
			}
			if ( event.key === "e" || event.key === "E" ) {
				sit();
			} else if ( event.key === "Enter" ) {
				event.preventDefault();
				chatRef.current?.focus();
			}
		};
		window.addEventListener( "keydown", onKeyDown );
		return () => window.removeEventListener( "keydown", onKeyDown );
	} );

	// Open tables take the room's table spots in the order the lobby lists them.
	const spots = WORLD.rooms.find( r => r.game === room )?.tables ?? [];
	const tableLabels = new Map( roomTables.flatMap( ( table, i ) => {
		const spot = spots[ i ];
		return spot ? [
			[
				`${ spot.x },${ spot.y }`,
				`${ table.seated }/${ table.playerCount }`
			] as const
		] : [];
	} ) );

	const now = useNow( state.bubbles.size > 0 );
	const bubbles = new Map( Array.from( state.bubbles ).filter( ( [ , b ] ) => b.until > now ) );
	const others = Array.from( state.others.values() );

	if ( !entered ) {
		return <EnterSplash onEnter={ () => setEntered( true ) }/>;
	}

	return (
		<>
			{ self
				? (
					<WorldStage
						self={ self }
						others={ others }
						bubbles={ bubbles }
						palette={ palette }
						tableLabels={ tableLabels }
						onTileClick={ walkTo }
					/>
				)
				: (
					<div className={ "absolute inset-0 flex items-center justify-center" }>
						<Spinner size={ "lg" }/>
					</div>
				) }

			{ connection && <ConnectionBanner state={ state } connection={ connection }/> }

			<HudCard className={ "absolute top-3 left-3 flex gap-2 items-center" }>
				<UsersIcon className={ "w-4 h-4" }/>
				<span className={ "text-sm font-heading" }>{ others.length + ( self ? 1 : 0 ) } HERE</span>
			</HudCard>

			{ room && (
				<div className={ "absolute top-3 right-3" }>
					<RoomPanel
						key={ room }
						game={ room }
						onTables={ tables => setFetched( { game: room, tables } ) }
					/>
				</div>
			) }

			{ near?.room.game && (
				<HudCard
					className={ "absolute bottom-20 left-1/2 -translate-x-1/2 text-sm flex gap-2 items-center" }>
					<Key>E</Key>
					{ nearTable
						? `to join this table (${ nearTable.seated }/${ nearTable.playerCount })`
						: "to open a new table" }
				</HudCard>
			) }

			<div className={ "absolute bottom-3 left-3" }>
				{ connection && <ChatBox onSay={ connection.say } inputRef={ chatRef }/> }
			</div>

			<HudCard className={ "absolute bottom-3 right-3 hidden md:flex gap-1 items-center text-xs" }>
				<Key>WASD</Key> walk · click to walk · <Key>E</Key> sit · <Key>Enter</Key> chat
			</HudCard>

			{ outlet && (
				<div className={ "absolute inset-0 z-10 overflow-auto bg-surface" }>
					<div className={ "sticky top-0 z-10 p-2 md:p-3" }>
						<Button variant={ "neutral" } size={ "sm" } onClick={ () => navigate( "/world" ) }>
							<ArrowLeftIcon className={ "w-4 h-4" }/> BACK TO THE ARENA
						</Button>
					</div>
					<div className={ cn( "px-2 pb-4 md:px-4 w-full flex justify-center" ) }>
						<GamePathProvider value={ "/world" }>{ outlet }</GamePathProvider>
					</div>
				</div>
			) }
		</>
	);
}

export function WorldPage() {
	return (
		<div className={ "fixed inset-x-0 bottom-0 top-15 md:top-20 overflow-hidden bg-surface" }>
			<RequireSession
				fallback={
					<div className={ "text-lg text-center mt-8" }>Log in to enter the arena.</div>
				}
			>
				<World/>
			</RequireSession>
		</div>
	);
}
