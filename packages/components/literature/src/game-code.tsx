import { Button } from "@base/components";
import { useGameCode } from "@literature/store";
import { CopyIcon } from "@radix-ui/react-icons";

export function GameCode() {
	const code = useGameCode();
	return (
		<div className={ "flex justify-between items-center rounded-md p-3 border-2" }>
			<div>
				<p className={ "text-sm" }>GAME CODE</p>
				<h2 className={ "text-4xl font-fjalla" }>{ code }</h2>
			</div>
			<div className={ "flex gap-3" }>
				<Button variant={ "link" }>
					<CopyIcon className={ "w-6 h-6" }/>
				</Button>
			</div>
		</div>
	);
}