import { vars } from "@common/ui";
import { recipe } from "@vanilla-extract/recipes";

export const keyboardClassnames = {

	letterWrapper: recipe( {
		base: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: 32,
			height: 48,
			borderRadius: 4,
			backgroundColor: vars.colors.gray[ 9 ],
			cursor: "pointer"
		},
		variants: {
			available: {
				true: {
					backgroundColor: vars.colors.gray[ 6 ]
				}
			},
			isEnter: {
				true: {
					backgroundColor: vars.colors[ "brand" ][ 9 ],
					width: 64
				}
			},
			isBack: {
				true: {
					backgroundColor: vars.colors[ "warning" ][ 9 ],
					width: 48
				}
			}
		},
		defaultVariants: {
			available: false,
			isEnter: false,
			isBack: false
		}
	} )
};

export const guessBlockClassnames = {
	guessLetterDiagram: recipe( {
		base: {
			width: 32,
			height: 32,
			textTransform: "uppercase",
			borderWidth: 1,
			borderStyle: "solid",
			borderRadius: 8,
			borderColor: vars.colors.gray[ 6 ],
			display: "flex",
			justifyContent: "center",
			alignItems: "center"
		},
		variants: {
			state: {
				correct: {
					backgroundColor: vars.colors[ "success" ][ 9 ]
				},

				wrongPlace: {
					backgroundColor: vars.colors[ "warning" ][ 9 ]
				},

				wrong: {
					backgroundColor: vars.colors[ "gray" ][ 9 ],
					color: vars.colors.white
				},

				empty: {}
			}
		},
		defaultVariants: {
			state: "empty"
		}
	} ),
	guessLetter: recipe( {
		base: {
			width: 48,
			height: 48,
			textTransform: "uppercase",
			borderWidth: 2,
			borderStyle: "solid",
			borderRadius: 8,
			borderColor: vars.colors.gray[ 6 ],
			display: "flex",
			justifyContent: "center",
			alignItems: "center"
		},
		variants: {
			state: {
				correct: {
					backgroundColor: vars.colors[ "success" ][ 9 ]
				},

				wrongPlace: {
					backgroundColor: vars.colors[ "warning" ][ 9 ]
				},

				wrong: {
					backgroundColor: vars.colors[ "gray" ][ 9 ],
					color: vars.colors.white
				},

				empty: {}
			}
		},
		defaultVariants: {
			state: "empty"
		}
	} )
};