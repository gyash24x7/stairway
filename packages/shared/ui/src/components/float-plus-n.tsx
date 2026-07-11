"use client";

import { cn } from "@s2h/ui/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type FloatPlusNProps = {
	value: number;
	className?: string;
};

export function FloatPlusN( { value, className }: FloatPlusNProps ) {
	const [ delta, setDelta ] = useState<{ id: number; amount: number } | null>( null );
	const [ prev, setPrev ] = useState( value );

	useEffect( () => {
		if ( value !== prev ) {
			const amount = value - prev;
			if ( amount !== 0 ) {
				setDelta( { id: Date.now(), amount } );
			}
			setPrev( value );
		}
	}, [ value, prev ] );

	useEffect( () => {
		if ( !delta ) {
			return;
		}
		const t = setTimeout( () => setDelta( null ), 1100 );
		return () => clearTimeout( t );
	}, [ delta ] );

	return (
		<span className={ "relative inline-flex" }>
			<AnimatePresence>
				{ delta && (
					<motion.span
						key={ delta.id }
						initial={ { opacity: 0, y: 0, scale: 0.8 } }
						animate={ { opacity: 1, y: -24, scale: 1 } }
						exit={ { opacity: 0, y: -36 } }
						transition={ { duration: 1 } }
						className={ cn(
							"absolute -top-1 right-0 text-sm font-heading pointer-events-none",
							delta.amount > 0 ? "text-kiwi" : "text-apple",
							className
						) }
					>
						{ delta.amount > 0 ? "+" : "" }{ delta.amount }
					</motion.span>
				) }
			</AnimatePresence>
		</span>
	);
}
