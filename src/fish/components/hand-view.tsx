"use client";

import { useFish } from "@/fish/components/context";
import { getBooksInHand, getBookDisplayString, getCardsOfBook } from "@/fish/core/utils";
import { RCard } from "@/shared/components/card";
import { cn } from "@/shared/utils/cn";
import { useMemo } from "react";

export function HandView() {
	const { match } = useFish();
	const hand = match.state.data.hand;

	const groupedCards = useMemo( () => {
		const books = getBooksInHand( hand, match.config.type );
		return books.map( book => ( {
			book,
			cards: getCardsOfBook( book, match.config.type, hand )
		} ) );
	}, [ hand, match.config.type ] );

	if ( hand.length === 0 ) {
		return (
			<div className={ "bg-background rounded-md p-3 w-full text-center" }>
				<p className={ "text-sm md:text-lg font-semibold opacity-60" }>
					NO CARDS LEFT — WATCH FOR CLAIMS FROM YOUR TEAM
				</p>
			</div>
		);
	}

	return (
		<div
			className={ cn(
				"bg-background rounded-md p-2 md:p-3 flex",
				"gap-4 md:gap-6 flex-wrap justify-center w-full"
			) }
		>
			{ groupedCards.map( ( { book, cards } ) => (
				<div key={ book } className={ "flex flex-col items-center gap-1" }>
					<span className={ "text-xs md:text-sm font-semibold opacity-60" }>
						{ getBookDisplayString( book, match.config.type ) }
					</span>
					<div className={ "flex gap-1.5 md:gap-2" }>
						{ cards.map( cardId => (
							<RCard key={ cardId } cardId={ cardId }/>
						) ) }
					</div>
				</div>
			) ) }
		</div>
	);
}
