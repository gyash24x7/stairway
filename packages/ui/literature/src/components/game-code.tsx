import { Button } from "@base/ui";
import { CopyIcon } from "@radix-ui/react-icons";
import { useGameCode } from "../store.ts";

export function GameCode() {
	const code = useGameCode();
	return (
		<div className={ "flex justify-between items-center border-gray-300 rounded-md p-3 border-2" }>
			<div>
				<p>GAME CODE</p>
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