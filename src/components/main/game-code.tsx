import { Button } from "@/components/base/button";
import { cn } from "@/utils/cn";
import { fjalla } from "@/utils/fonts";
import { CopyIcon } from "lucide-react";
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
				<p className={ "text-sm" }>GAME CODE</p>
				<h2 className={ cn( "text-5xl", fjalla.className ) }>{ code }</h2>
			</div>
			<div className={ "flex gap-3" }>
				<Button variant={ "noShadow" } onClick={ handleCopy } className={ "px-2 py-4" }>
					<CopyIcon className={ "w-6 h-6" }/>
				</Button>
			</div>
		</div>
	);
}