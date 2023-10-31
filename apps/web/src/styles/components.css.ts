import { style } from "@vanilla-extract/css";
import { vars } from "@s2h/ui";
import { recipe } from "@vanilla-extract/recipes";
import { rgba } from "@mantine/core";

export const appLayoutClassnames = {
	main: style( {
		background: vars.colors[ "gray" ][ 1 ],
		paddingTop: 125,
		paddingBottom: 220
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
	} ),

	footer: style( {
		backgroundSize: "cover",
		backgroundPosition: "center",
		backgroundImage: "url(background.jpg)",
		borderTop: `1px solid ${ vars.colors[ "gray" ][ 3 ] }`
	} ),

	inner: style( {
		paddingTop: 40,
		paddingBottom: 40,
		backgroundColor: rgba( vars.colors.black, 0.3 ),
		backdropFilter: "blur(5px)"
	} )
};