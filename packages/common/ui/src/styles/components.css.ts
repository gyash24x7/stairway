import { rem, rgba } from "@mantine/core";
import { CardSuit } from "@s2h/cards";
import { style, styleVariants } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "./theme";

export const applicationCardClassnames = {
	card: style( {
		height: 300,
		width: 300,
		borderRadius: 10,
		color: vars.colors.white,
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

export const navTabsClassnames = {
	tabsList: style( {
		"::before": {
			display: "none"
		}
	} ),

	tab: recipe( {
		base: {
			fontWeight: 700,
			height: 40,
			backgroundColor: "transparent",
			position: "relative",
			borderBottomWidth: 0,
			textTransform: "uppercase",
			":hover": {
				backgroundColor: vars.colors[ "gray" ][ 1 ]
			}
		},
		variants: {
			isActive: {
				true: {
					backgroundColor: vars.colors[ "gray" ][ 1 ]
				}
			}
		},
		defaultVariants: {
			isActive: false
		}
	} )
};

export const layoutClassnames = {
	main: style( {
		background: vars.colors[ "gray" ][ 1 ],
		paddingTop: "125px !important",
		paddingBottom: "220px !important",
		minHeight: "100vh"
	} ),

	header: style( {
		background: vars.colors.white,
		border: "none"
	} ),

	navContainer: style( {
		display: "flex",
		justifyContent: "space-between",
		flexDirection: "column"
	} ),

	footer: style( {
		backgroundSize: "cover",
		backgroundPosition: "center",
		backgroundImage: "url(background.jpg)",
		borderTopWidth: 1,
		borderTopStyle: "solid",
		borderTopColor: vars.colors[ "gray" ][ 3 ]
	} ),

	inner: style( {
		paddingTop: 40,
		paddingBottom: 40,
		backgroundColor: rgba( vars.colors.black, 0.3 ),
		backdropFilter: "blur(5px)"
	} )
};