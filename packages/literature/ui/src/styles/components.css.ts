import { style } from "@vanilla-extract/css";
import { vars } from "@s2h/ui";
import { rem } from "@mantine/core";

export const gameDescriptionClassnames = {
	copyIcon: style( {
		cursor: "pointer",
		padding: 4,
		":hover": { background: vars.colors[ "gray" ][ 4 ] },
		borderRadius: 8
	} )
};

export const homePageClassnames = {
	card: style( {
		height: 300,
		width: "100%",
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

export const gamePageClassnames = {
	stack: style( {
		borderRightWidth: 2,
		borderRightStyle: "dashed",
		borderColor: vars.colors[ "gray" ][ 3 ]
	} ),
	playArea: style( {
		flex: 1,
		padding: 20,
		justifyContent: "space-between",
		flexDirection: "column",
		height: "100%"
	} )
};

export const gameStatusClassnames = {
	banner: style( {
		background: "light",
		borderStyle: "solid",
		borderWidth: 2,
		width: "100%",
		padding: 8,
		borderRadius: 8,
		borderColor: vars.colors[ "gray" ][ 3 ]
	} )
};