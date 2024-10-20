"use client";

import { CopyIcon } from "@radix-ui/react-icons";
import { Button, fjalla } from "@stairway/components/base";
import { useCopyToClipboard } from "usehooks-ts";

export function GameCode( { code }: { code: string } ) {
	const [ _, copy ] = useCopyToClipboard();

	const handleCopy = () => {
		copy( code ).catch( error => {
			console.error( "Failed to copy!", error );
		} );
	};

	return (
		<div className={ "flex justify-between items-center rounded-md p-3 border-2" }>
			<div>
				<p className={ "text-sm" }>Game Code</p>
				<h2 className={ `text-4xl ${ fjalla.className }` }>{ code }</h2>
			</div>
			<div className={ "flex gap-3" }>
				<Button variant={ "link" } onClick={ handleCopy }>
					<CopyIcon className={ "w-6 h-6" }/>
				</Button>
			</div>
		</div>
	);
}