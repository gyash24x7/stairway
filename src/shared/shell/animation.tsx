import type { Transition, Variants } from "framer-motion";

/**
 * The one spring the app animates on.
 *
 * Four hand-tuned springs were in use for the same gesture (380/22, 400/18,
 * 420/22, 500/20), which is a difference nobody can name but everybody can feel
 * when two of them run side by side.
 */
export const SPRING: Transition = { type: "spring", stiffness: 380, damping: 22 };

/** The same spring, snappier, for a figure ticking over rather than arriving. */
export const SPRING_TIGHT: Transition = { type: "spring", stiffness: 420, damping: 24 };

/**
 * A pulse a seat's own row uses to say "this one is you".
 *
 * Reduced motion is handled globally in `styles.css`, which flattens every
 * animation and transition — this keeps the shape in one place regardless.
 */
export const pulseRing = ( color = "var(--color-accent)" ) => ( {
	boxShadow: [
		"0 0 0 0 rgba(0,0,0,0)",
		`0 0 0 6px ${ color }`,
		"0 0 0 0 rgba(0,0,0,0)"
	]
} );

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
