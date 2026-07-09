"use client";

import { Logo } from "@/shared/components/logo";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { cn } from "@/shared/utils/cn";
import { CheckIcon, CopyIcon, MenuIcon } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";

type GameInfoProps = {
	code?: string;
	name: string;
	additionalInfo?: ReactNode;
	actions?: ReactNode;
	completed?: boolean;
}

export function GameInfo( { code, name, additionalInfo, actions, completed }: GameInfoProps ) {
	const [ _, copy ] = useCopyToClipboard();
	const [ infoOpen, setInfoOpen ] = useState( false );
	const [ copied, setCopied ] = useState( false );

	useEffect( () => {
		if ( !copied ) {
			return;
		}
		const timeout = setTimeout( () => setCopied( false ), 1500 );
		return () => clearTimeout( timeout );
	}, [ copied ] );

	const handleCopy = () => {
		copy( code ?? "" )
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
						url={ `/logos/${ name.toLowerCase() }.svg` }
						classname={ "bg-neutral-dark w-9 h-9" }
					/>
					<h2 className={ "text-3xl font-title text-neutral-dark hidden md:block" }>
						{ name.toUpperCase() }
					</h2>
				</div>
				<div className={ "flex-1 flex items-center min-w-0" }>
					{ code && (
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>GAME CODE</p>
							<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>
								{ code }
							</h2>
						</div>
					) }
					{ additionalInfo && (
						<div className={ "hidden md:flex items-center" }>
							{ additionalInfo }
						</div>
					) }
				</div>
				<div className={ "py-2 px-4 flex justify-end gap-2 items-center" }>
					{ additionalInfo && (
						<Button
							onClick={ () => setInfoOpen( true ) }
							size={ "icon" }
							className={ "w-8 h-8 md:hidden" }
						>
							<MenuIcon className={ "w-4 h-4" }/>
						</Button>
					) }
					{ code && (
						<Button
							onClick={ handleCopy }
							size={ "icon" }
							className={ "w-8 h-8 md:h-10 md:w-10" }
						>
							{ copied
								? <CheckIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
								: <CopyIcon className={ "w-4 h-4 md:h-6 md:w-6" }/> }
						</Button>
					) }
					{ actions }
				</div>
			</div>
			{ additionalInfo && (
				<Drawer open={ infoOpen } onOpenChange={ setInfoOpen }>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle>{ name.toUpperCase() } INFO</DrawerTitle>
							<DrawerDescription/>
						</DrawerHeader>
						<div className={ "px-4 pb-4 flex gap-2" }>
							{ code && (
								<div className={ "py-2 px-4" }>
									<p className={ "text-xs md:text-sm" }>GAME CODE</p>
									<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>
										{ code }
									</h2>
								</div>
							) }
							{ additionalInfo }
						</div>
					</DrawerContent>
				</Drawer>
			) }
			{ completed && (
				<div className={ "flex flex-col gap-3 w-full" }>
					<div className={ "rounded-md bg-accent text-neutral-dark" }>
						<p className={ "font-semibold lg:text-6xl text-4xl text-center p-3" }>
							Game&nbsp;Completed
						</p>
					</div>
				</div>
			) }
		</Fragment>
	);
}
