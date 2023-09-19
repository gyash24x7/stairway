import { style, styleVariants } from "@vanilla-extract/css";
import { rem } from "@mantine/core";
import { vars } from "./theme";
import { CardSuit } from "@s2h/cards";

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
		backgroundImage: "url(background.jpg)",
		borderColor: vars.colors.gray[ 6 ],
		borderStyle: "dashed",
		borderWidth: rem( 1 )
	} ),

	title: style( {
		fontWeight: 900,
		color: vars.colors.white,
		lineHeight: 1.2,
		fontSize: rem( 32 ),
		marginTop: vars.spacing.xs
	} ),

	category: style( {
		color: vars.colors.white,
		opacity: 0.7,
		fontWeight: 700,
		textTransform: "uppercase"
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
		height: 96,
		width: 64,
		paddingLeft: 8,
		paddingTop: 4,
		fontSize: 60,
		fontFamily: vars.fontFamilyHeadings
	} ),

	cardColor: styleVariants( {
		[ CardSuit.SPADES ]: { color: vars.colors[ "gray" ][ 8 ] },
		[ CardSuit.CLUBS ]: { color: vars.colors[ "gray" ][ 8 ] },
		[ CardSuit.HEARTS ]: { color: vars.colors[ "danger" ][ 6 ] },
		[ CardSuit.DIAMONDS ]: { color: vars.colors[ "danger" ][ 6 ] }
	} )
};
