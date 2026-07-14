import type { BoardSize } from "@s2h/kingdomino/schema";
import { CreateGame } from "@s2h/ui/components/create-game";
import { RadioSelect } from "@s2h/ui/primitives/radio-select";
import { useState } from "react";
import { createKingdominoGameFn } from "./client";

export function KingdominoCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<2 | 3 | 4>();
	const [ boardSize, setBoardSize ] = useState<BoardSize>();

	const createKingdominoGame = async (): Promise<string> => {
		if ( !playerCount || !boardSize ) {
			return "";
		}
		const { id } = await createKingdominoGameFn( { playerCount, autoStart: true, boardSize } );
		return id;
	};

	return (
		<CreateGame
			game={ "kingdomino" }
			disabled={ !playerCount || !boardSize }
			createGame={ createKingdominoGame }
		>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>
					Player Count
				</label>
				<RadioSelect
					options={ [ 2, 3, 4 ] as const }
					value={ playerCount }
					onChange={ setPlayerCount }
					isDisabled={ count => boardSize === 7
						? count !== 2
						: boardSize === 5 ? count === 2 : false
					}
				/>

				<label className={ "text-sm text-muted-foreground" }>
					Board&nbsp;Size
				</label>
				<RadioSelect
					options={ [ 5, 7 ] as const }
					value={ boardSize }
					onChange={ setBoardSize }
					isDisabled={ size => playerCount === 2
						? size !== 7
						: !!playerCount ? size !== 5 : false
					}
				/>
			</div>
		</CreateGame>
	);
}
