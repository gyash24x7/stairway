import { createTheme } from "@mantine/core";
import { themeToVars } from "@mantine/vanilla-extract";
import { generateColors } from "@mantine/colors-generator";

export const theme = createTheme( {
	colors: {
		primary: generateColors( "#0052CC" ),
		danger: generateColors( "#DE350B" ),
		warning: generateColors( "#FF991F" ),
		success: generateColors( "#00875A" ),
		alt: generateColors( "#5243AA" ),
		info: generateColors( "#00B8D9" )
	},
	fontFamily: "Raleway",
	headings: {
		fontFamily: "Fjalla One",
		fontWeight: "lighter"
	}
} );

export const vars = themeToVars( theme );