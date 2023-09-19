import { rem } from "@mantine/core";
import { style } from "@vanilla-extract/css";
import { vars } from "@s2h/ui";

export const authLayoutClassnames = {
	wrapper: style( {
		height: "100vh",
		minHeight: rem( 900 ),
		backgroundSize: "cover",
		backgroundImage: "url(background.jpg)"
	} ),

	form: style( {
		display: "flex",
		flexDirection: "column",
		justifyContent: "center",
		borderRightWidth: rem( 1 ),
		borderRightStyle: "solid",
		borderRightColor: vars.colors.gray[ 3 ],
		height: "100vh",
		maxWidth: rem( 450 ),
		minWidth: rem( 400 ),
		paddingTop: rem( 80 ),

		"@media": {
			[ vars.smallerThan( "sm" ) ]: {
				maxWidth: "100%"
			}
		},

		selectors: {
			[ vars.darkSelector ]: {
				borderColor: vars.colors.gray[ 1 ]
			}
		}
	} ),

	logo: style( { width: "100%", height: 200, objectFit: "contain" } )
};

export const pageClassnames = {
	title: style( {
		color: vars.colors.black,
		fontFamily: vars.fontFamilyHeadings,
		fontWeight: "lighter",
		selectors: {
			[ vars.darkSelector ]: {
				color: vars.colors.white
			}
		}
	} )
};

export const userCardClassnames = {
	icon: style( {
		color: vars.colors.gray[ 5 ],
		selectors: {
			[ vars.darkSelector ]: {
				color: vars.colors.dark[ 3 ]
			}
		}
	} ),

	name: style( { fontFamily: vars.fontFamilyHeadings } )
};