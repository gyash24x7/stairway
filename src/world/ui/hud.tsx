import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { cn } from "cn";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { OpenTable } from "@/lobby/schema";
import { openTablesAtom } from "@/lobby/ui/client";
import type { GameName } from "@/shared/games";
import { GAMES } from "@/shared/games";
import { Button } from "@/shared/primitives/button";
import { Input } from "@/shared/primitives/input";
import { Spinner } from "@/shared/primitives/spinner";
import { Logo } from "@/shared/shell/logo";
import { MAX_SAY_LENGTH } from "@/world/schema";


/** How often a room's table list is refetched while you stand in it. */
const ROOM_REFRESH_MILLIS = 5_000;

export function HudCard( { className, children }: { className?: string; children: ReactNode } ) {
	return (
		<div className={ cn(
			"rounded-md border-2 border-outline bg-background shadow-sm p-3",
			className
		) }>
			{ children }
		</div>
	);
}

/**
 * The open tables of the room you are standing in, kept fresh while you stay.
 *
 * The lobby is a plain query, not a subscription (see `openTablesAtom`), so
 * this polls it instead. Polling is limited to the one room you are in, and it
 * stops when you leave, which keeps it inside the lobby's own rule of not
 * holding something open for everyone browsing.
 *
 * Reports what it fetched through `onTables`, because the stage also needs the
 * list to label the tables on the map.
 */
function useRoomTables( game: GameName, onTables: ( tables: ReadonlyArray<OpenTable> ) => void ) {
	const atom = openTablesAtom( game );
	const result = useAtomValue( atom );
	const refresh = useAtomRefresh( atom );

	useEffect( () => {
		const timer = setInterval( refresh, ROOM_REFRESH_MILLIS );
		return () => clearInterval( timer );
	}, [ refresh ] );

	const tables = AsyncResult.isSuccess( result ) ? result.value : undefined;
	// Reported only when the list itself changes. The callback is read from a
	// ref so a parent passing a fresh arrow every render cannot loop this.
	const report = useRef( onTables );
	useEffect( () => {
		report.current = onTables;
	} );
	useEffect( () => {
		report.current( tables ?? [] );
	}, [ tables ] );

	return { tables, waiting: result.waiting && !tables };
}

type RoomPanelProps = {
	game: GameName;
	onTables: ( tables: ReadonlyArray<OpenTable> ) => void;
};

export function RoomPanel( { game, onTables }: RoomPanelProps ) {
	const { tables, waiting } = useRoomTables( game, onTables );
	const meta = GAMES[ game ];

	return (
		<HudCard className={ "w-72 flex flex-col gap-3" }>
			<div className={ "flex gap-3 items-center" }>
				<Logo url={ `/logos/${ game }.svg` } classname={ "w-10 h-10 bg-accent shrink-0" }/>
				<div className={ "min-w-0" }>
					<h2 className={ "font-title text-xl text-accent leading-none" }>{ meta.title }</h2>
					<p className={ "text-xs text-muted-foreground mt-1" }>{ meta.tagline }</p>
				</div>
			</div>

			<div className={ "flex flex-col gap-2" }>
				<p className={ "text-metric-label" }>OPEN TABLES</p>
				{ waiting && <Spinner/> }
				{ tables && tables.length === 0 && (
					<p className={ "text-xs text-muted-foreground" }>
						Nobody is waiting here yet. Sit at any table to open one.
					</p>
				) }
				{ tables?.map( ( table, i ) => (
					<Link
						key={ table.gameId }
						to={ `/world/${ game }/${ table.gameId }/join` }
						className={ cn(
							"flex items-center justify-between gap-2 rounded-base border-2 border-outline",
							"px-2 py-1 text-sm hover:bg-accent hover:text-neutral-dark"
						) }
					>
						<span className={ "font-heading" }>TABLE { i + 1 }</span>
						<span className={ "text-xs truncate" }>
							{ table.players.map( p => p.name ).join( ", " ) }
						</span>
						<span className={ "text-xs shrink-0" }>{ table.seated }/{ table.playerCount }</span>
					</Link>
				) ) }
			</div>

			<Link to={ `/world/${ game }` }>
				<Button size={ "sm" } className={ "w-full" }>NEW TABLE</Button>
			</Link>
		</HudCard>
	);
}

/** The chat line. Enter opens it from anywhere in the world, Enter sends, and Escape closes it. */
export function ChatBox( { onSay, inputRef }: {
	onSay: ( text: string ) => void;
	inputRef: React.RefObject<HTMLInputElement | null>;
} ) {
	const [ text, setText ] = useState( "" );

	return (
		<form
			onSubmit={ event => {
				event.preventDefault();
				if ( text.trim() ) {
					onSay( text.trim() );
				}
				setText( "" );
				inputRef.current?.blur();
			} }
		>
			<Input
				ref={ inputRef }
				value={ text }
				maxLength={ MAX_SAY_LENGTH }
				placeholder={ "Press Enter to chat" }
				onChange={ event => setText( event.target.value ) }
				onKeyDown={ event => {
					if ( event.key === "Escape" ) {
						setText( "" );
						event.currentTarget.blur();
					}
				} }
				className={ "w-64 shadow-sm" }
			/>
		</form>
	);
}

export function Key( { children }: { children: ReactNode } ) {
	return (
		<kbd
			className={ "rounded-base border-2 border-outline bg-background px-1.5 text-xs font-heading" }>
			{ children }
		</kbd>
	);
}
