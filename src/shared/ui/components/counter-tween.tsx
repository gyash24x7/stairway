import { AnimatePresence, motion } from "framer-motion";

import { SPRING_TIGHT } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

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
					transition={ SPRING_TIGHT }
					className={ "inline-block" }
				>
					{ value }
				</motion.span>
			</AnimatePresence>
		</span>
	);
}
