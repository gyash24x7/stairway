import { rem } from "@mantine/core";
import { style } from "@vanilla-extract/css";
import { vars } from "@s2h/ui";

export const homePageClassnames = {
	themeToggle: style( {
		backgroundColor: vars.colors.gray[ 0 ],
		color: vars.colors.primary[ 6 ],
		selectors: {
			[ vars.darkSelector ]: {
				backgroundColor: vars.colors.gray[ 6 ],
				color: vars.colors[ "warning" ][ 4 ]
			}
		}
	} ),

	userInfo: style( {
		borderRadius: vars.radius.md,
		borderColor: vars.colors.gray[ 6 ],
		borderStyle: "dashed",
		borderWidth: rem( 1 )
	} )
};