import { generateColors } from "@mantine/colors-generator";
import { createTheme } from "@mantine/core";

export const theme = createTheme( {
	colors: {
		brand: generateColors( "#0052CC" ),
		danger: generateColors( "#DE350B" ),
		warning: generateColors( "#FF991F" ),
		success: generateColors( "#00875A" ),
		alt: generateColors( "#5243AA" ),
		info: generateColors( "#00B8D9" )
	},
	fontFamily: "Montserrat",
	headings: {
		fontFamily: "Saira Extra Condensed",
		fontWeight: "600"
	}
} );
