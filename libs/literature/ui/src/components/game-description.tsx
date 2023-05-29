import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { Flex } from "@s2h/ui";

import { useCopyToClipboard } from "react-use";
import { useGame } from "../utils";

export const GameDescription = () => {
	const { code } = useGame();
	const [ , copyToClipboard ] = useCopyToClipboard();

	return (
		<div className={ "my-2" }>
			<p>Game Code</p>
			<Flex justify={ "space-between" } align={ "center" } className={ "w-full" }>
				<h1 className={ "text-6xl font-fjalla" }>{ code }</h1>
				<DocumentDuplicateIcon
					width={ 40 }
					height={ 40 }
					className={ "cursor-pointer" }
					onClick={ () => copyToClipboard( code ) }
				/>
			</Flex>
		</div>
	);
};