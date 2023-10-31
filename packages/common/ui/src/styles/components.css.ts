import { rem } from "@mantine/core";
import { CardSuit } from "@s2h/cards";
import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "./theme";
import { recipe } from "@vanilla-extract/recipes";

export const applicationCardClassnames = {
	card: style( {
		height: 300,
		width: 300,
		display: "flex",
		flexDirection: "column",
		justifyContent: "space-between",
		alignItems: "flex-start",
		backgroundSize: "cover",
		backgroundPosition: "center",
		backgroundImage: "url(background.jpg)"
	} )
};

export const errorPageClassnames = {
	root: style( { paddingTop: rem( 80 ), paddingBottom: rem( 80 ) } ),

	label: style( {
		textAlign: "center",
		fontWeight: 900,
		fontSize: rem( 220 ),
		lineHeight: 1,
		marginBottom: `calc(${ vars.spacing.xl } * 1.5)`,
		color: vars.colors.gray[ 2 ],

		"@media": {
			[ vars.smallerThan( "sm" ) ]: {
				fontSize: rem( 120 )
			}
		},

		selectors: {
			[ vars.darkSelector ]: {
				color: vars.colors.gray[ 4 ]
			}
		}
	} ),

	title: style( {
		fontFamily: vars.fontFamilyHeadings,
		textAlign: "center",
		fontWeight: 900,
		fontSize: rem( 38 ),

		"@media": {
			[ vars.smallerThan( "sm" ) ]: {
				fontSize: rem( 32 )
			}
		}
	} ),

	description: style( {
		maxWidth: rem( 500 ),
		margin: "auto",
		marginTop: vars.spacing.xl,
		marginBottom: `calc(${ vars.spacing.xl } * 1.5)`
	} )
};

export const playingCardClassnames = {
	wrapper: style( {
		borderWidth: 1,
		borderColor: vars.colors[ "gray" ][ 4 ],
		borderStyle: "solid",
		borderRadius: 4,
		background: vars.colors[ "gray" ][ 1 ],
		minWidth: 80,
		paddingLeft: 8,
		paddingRight: 8,
		fontSize: 48,
		fontFamily: vars.fontFamilyHeadings
	} ),

	cardColor: styleVariants( {
		[ CardSuit.SPADES ]: { color: vars.colors[ "gray" ][ 8 ] },
		[ CardSuit.CLUBS ]: { color: vars.colors[ "gray" ][ 8 ] },
		[ CardSuit.HEARTS ]: { color: vars.colors[ "danger" ][ 6 ] },
		[ CardSuit.DIAMONDS ]: { color: vars.colors[ "danger" ][ 6 ] }
	} )
};

export const cardClassnames = {
	root: recipe( {
		base: {
			width: "100%",
			padding: 20,
			background: vars.colors.white,
			borderWidth: 1,
			borderStyle: "solid",
			borderRadius: 10,
			borderColor: vars.colors[ "gray" ][ 3 ]
		},
		variants: {
			stretch: {
				true: {
					flex: 1
				}
			}
		},
		defaultVariants: {
			stretch: false
		}
	} )
};