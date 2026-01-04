import { Button } from "@s2h-ui/primitives/button";
import { CopyIcon } from "@s2h-ui/primitives/icons";
import { cn } from "@s2h-ui/primitives/utils";
import type { ReactNode } from "react";
import { useCopyToClipboard } from "usehooks-ts";

export type GameDetailsProps = {
	code: string;
	name: string;
	additionalInfo?: ReactNode;
	actions?: ReactNode;
}

export function GameCode( { code, name, additionalInfo, actions }: GameDetailsProps ) {
	const [ _, copy ] = useCopyToClipboard();

	const handleCopy = () => {
		copy( code ).catch( error => {
			console.error( "Failed to copy!", error );
		} );
	};

	return (
		<div className={ "flex gap-2 rounded-md border-2 bg-background" }>
			<div className={ "flex gap-2 items-center bg-accent px-2 py-1 rounded-l-md border-r-2" }>
				<img src={ "/s2h.png" } alt={ "logo" } className={ "h-10 md:h-12" }/>
				<h2 className={ "text-4xl font-heading text-neutral-dark hidden md:block" }>
					{ name.toUpperCase() }
				</h2>
			</div>
			<div className={ "flex-1 flex items-center" }>
				<div className={ "py-2 px-4" }>
					<p className={ "text-xs md:text-sm" }>GAME CODE</p>
					<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>{ code }</h2>
				</div>
				{ additionalInfo }
			</div>
			<div className={ "py-2 px-4 flex justify-end gap-2 items-center" }>
				<Button onClick={ handleCopy } size={ "icon" } className={ "w-8 h-8 md:h-10 md:w-10" }>
					<CopyIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
				</Button>
				{ actions }
			</div>
		</div>
	);
}