"use client";

import { cn } from "@/shared/utils/cn";
import { AnimatePresence, motion } from "framer-motion";

type CounterTweenProps = {
	value: number | string;
	className?: string;
};

export function CounterTween( { value, className }: CounterTweenProps ) {
	return (
		<span className={ cn( "relative inline-block tabular-nums", className ) }>
			<AnimatePresence mode={ "popLayout" } initial={ false }>
				<motion.span
					key={ String( value ) }
					initial={ { scale: 0.5, opacity: 0 } }
					animate={ { scale: 1, opacity: 1 } }
					exit={ { scale: 0.5, opacity: 0 } }
					transition={ { type: "spring", stiffness: 420, damping: 22 } }
					className={ "inline-block" }
				>
					{ value }
				</motion.span>
			</AnimatePresence>
		</span>
	);
}
