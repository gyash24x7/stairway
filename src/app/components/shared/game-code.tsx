"use client";

import { Button } from "@/app/primitives/button";
import { Separator } from "@/app/primitives/separator";
import { cn } from "@/utils/cn";
import { CopyIcon } from "lucide-react";
import { useCopyToClipboard } from "usehooks-ts";

export function GameCode( { code, name }: { code: string; name: string; } ) {
	const [ _, copy ] = useCopyToClipboard();

	const handleCopy = () => {
		copy( code ).catch( error => {
			console.error( "Failed to copy!", error );
		} );
	};

	return (
		<div className={ "flex gap-2 rounded-md border-2" }>
			<div className={ "flex gap-2 items-center bg-main px-2 py-1 rounded" }>
				<img src={ "/s2h.png" } alt={ "logo" } className={ "h-10 md:h-12" }/>
				<h2 className={ "text-4xl font-heading text-main-foreground hidden md:block" }>
					{ name.toUpperCase() }
				</h2>
			</div>
			<Separator orientation={ "vertical" }/>
			<div className={ "p-2 flex-1" }>
				<p className={ "text-xs md:text-sm" }>GAME CODE</p>
				<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>{ code }</h2>
			</div>
			<div className={ "flex justify-between items-center px-2" }>
				<Button
					variant={ "noShadow" }
					onClick={ handleCopy }
					size={ "icon" }
					className={ "w-8 h-8 md:h-10 md:w-10" }
				>
					<CopyIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
				</Button>
			</div>
		</div>
	);
}