import { vars } from "@common/ui";
import { style } from "@vanilla-extract/css";

export const gameDescriptionClassnames = {
	copyIcon: style( {
		cursor: "pointer",
		padding: 4,
		":hover": { background: vars.colors[ "gray" ][ 4 ] },
		borderRadius: 8
	} ),

	teamBox: style( {
		flex: 1
	} )
};

export const homePageClassnames = {
	heroText: style( {
		fontSize: 64,
		fontWeight: 900,
		color: vars.colors.black
	} )
};
