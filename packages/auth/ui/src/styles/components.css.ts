import { rem, rgba } from "@mantine/core";
import { vars } from "@s2h/ui";
import { style } from "@vanilla-extract/css";

export const privateLayoutClassnames = {
	main: style( {
		background: vars.colors[ "gray" ][ 1 ],
		paddingTop: 125,
		paddingBottom: 220,
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

export const publicLayoutClassnames = {
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
		fontSize: "48px",
		selectors: {
			[ vars.darkSelector ]: {
				color: vars.colors.white
			}
		}
	} )
};
