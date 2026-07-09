import type { Variants } from "framer-motion";

export const popIn: Variants = {
	initial: { scale: 0, opacity: 0 },
	animate: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 400, damping: 18 } },
	exit: { scale: 0, opacity: 0, transition: { duration: 0.15 } }
};

export const fadeIn: Variants = {
	initial: { opacity: 0 },
	animate: { opacity: 1, transition: { duration: 0.25 } },
	exit: { opacity: 0, transition: { duration: 0.15 } }
};

export const slideInUp: Variants = {
	initial: { opacity: 0, scale: 0.85 },
	animate: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 380, damping: 22 } },
	exit: { opacity: 0, scale: 0.85, transition: { duration: 0.2 } }
};

export const slideInRight: Variants = {
	initial: { opacity: 0, scale: 0.85 },
	animate: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 380, damping: 22 } },
	exit: { opacity: 0, scale: 0.85, transition: { duration: 0.2 } }
};

export const shake = {
	x: [ 0, -8, 8, -8, 8, -4, 4, 0 ],
	transition: { duration: 0.5 }
} as const;

export const flipReveal = ( index: number ) => ( {
	initial: { rotateX: 0 },
	animate: {
		rotateX: [ 0, 90, 0 ],
		transition: { duration: 0.6, times: [ 0, 0.5, 1 ], delay: index * 0.15 }
	}
} );

export const staggerContainer: Variants = {
	animate: {
		transition: { staggerChildren: 0.08, delayChildren: 0.05 }
	}
};
