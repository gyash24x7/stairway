import { style } from "@vanilla-extract/css";
import { vars } from "@s2h/ui";

export const gameDescriptionClassnames = {
	copyIcon: style( {
		cursor: "pointer",
		padding: 4,
		":hover": { background: vars.colors[ "gray" ][ 4 ] },
		borderRadius: 8
	} )
};

export const homePageClassnames = {
	flex: style( {
		width: "100vw",
		minHeight: "100vh",
		padding: 40,
		backgroundImage: "url('background.jpg')",
		backgroundSize: "cover"
	} ),

	stack: style( {
		width: "40%",
		maxWidth: 400,
		padding: 30,
		borderRightStyle: "solid",
		borderRightWidth: 1,
		borderColor: vars.colors[ "gray" ][ 3 ],
		borderRadius: 4,
		backgroundColor: vars.colors[ "gray" ][ 2 ]
	} )
};

export const gamePageClassnames = {
	stack: style( {
		borderRightWidth: 2,
		borderRightStyle: "dashed",
		borderColor: vars.colors[ "gray" ][ 3 ]
	} )
};