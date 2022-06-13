import { Flex } from "@s2h/ui";
import { useGame } from "../utils/game-context";
import { DuplicateIcon } from "@heroicons/react/outline";
import { useCopyToClipboard } from "react-use";

export const GameDescription = function () {
	const { code } = useGame();
	const [ , copyToClipboard ] = useCopyToClipboard();

	return (
		<div className = { "my-2" }>
			<p>Game Code</p>
			<Flex justify = { "space-between" } align = { "center" } className = { "w-full" }>
				<h1 className = { "text-6xl font-fjalla" }>{ code }</h1>
				<DuplicateIcon
					width = { 40 }
					height = { 40 }
					className = { "cursor-pointer" }
					onClick = { () => copyToClipboard( code ) }
				/>
			</Flex>
		</div>
	);
};