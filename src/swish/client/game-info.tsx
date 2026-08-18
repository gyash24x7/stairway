"use client";

import { Link } from "@tanstack/react-router";
import { CheckIcon, CopyIcon, MenuIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";

import type { ReactNode } from "react";

import { ChatPanel } from "@/chat/client/chat-panel.tsx";
import { Logo } from "@/shared/ui/components/logo.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { StatBlock } from "@/swish/client/stat-block.tsx";
import { TurnTimer } from "@/swish/client/turn-timer.tsx";

import type { GameId } from "@/swish/shared/schema.ts";

type GameInfoProps = {
	id: GameId;
	code: string;
	name: string;
	additionalInfo?: ReactNode;
	deadline?: number;
	completed?: boolean;
	showChat?: boolean;
	couchSupport?: boolean;
};

const couchLink = ( game: string ) => `/${ game }/$gameId/couch` as string;
const controllerLink = ( game: string ) => `/${ game }/$gameId/controller` as string;

export function GameInfo( props: GameInfoProps ) {
	const [ _, copy ] = useCopyToClipboard();
	const [ infoOpen, setInfoOpen ] = useState( false );
	const [ copied, setCopied ] = useState( false );

	const Icon = copied ? CheckIcon : CopyIcon;

	useEffect( () => {
		if ( !copied ) {
			return;
		}
		const timeout = setTimeout( () => setCopied( false ), 1500 );
		return () => clearTimeout( timeout );
	}, [ copied ] );

	const handleCopy = () => {
		copy( props.code ?? "" )
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
				<div className={ "flex-1 flex items-center min-w-0" }>
					<StatBlock label={ "GAME CODE" }>{ props.code }</StatBlock>
					{ props.additionalInfo && (
						<div className={ "hidden md:flex items-center min-w-0" }>
							{ props.additionalInfo }
						</div>
					) }
				</div>
				<div className={ "p-2 flex justify-end gap-2 items-center" }>
					<TurnTimer deadline={ props.deadline } className={ "shrink-0 pr-2" }/>
					{ !!props.additionalInfo && (
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
								to={ couchLink( props.name ) }
								params={ { gameId: props.id } }
								title={ "Show the board on a TV" }
							>
								<Button size={ "icon" } className={ "flex gap-2 items-center" }>
									<MonitorIcon className={ "w-4 h-4 md:w-6 md:h-6" }/>
								</Button>
							</Link>
							<Link
								to={ controllerLink( props.name ) }
								params={ { gameId: props.id } }
								title={ "Use this device as a controller" }
							>
								<Button size={ "icon" } className={ "flex gap-2 items-center" }>
									<SmartphoneIcon className={ "w-4 h-4 md:w-6 md:h-6" }/>
								</Button>
							</Link>
						</div>
					) }
					{ !!props.showChat && <ChatPanel channelId={ props.id }/> }
					<Button
						onClick={ handleCopy }
						size={ "icon" }
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
						{ !!props.couchSupport && (
							<div className={ "flex gap-2 flex-wrap items-center justify-center" }>
								<Link
									to={ couchLink( props.name ) }
									params={ { gameId: props.id } }
									title={ "Show the board on a TV" }
								>
									<Button size={ "sm" } className={ "flex gap-2 items-center" }>
										<MonitorIcon className={ "w-4 h-4 md:w-6 md:h-6" }/>
										<span>SHOW ON TV</span>
									</Button>
								</Link>
								<Link
									to={ controllerLink( props.name ) }
									params={ { gameId: props.id } }
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
				// Deliberately quiet and off-accent: `GameStandings` renders the accent
				// headline naming the winner directly below, and two full-width accent
				// bars announcing the same thing in different words is what this was.
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
