const path = require( "path" );

module.exports = {
	content: [
		path.join( __dirname, "./src/**/*.{js,ts,jsx,tsx}" )
	],
	darkMode: "class",
	theme: {
		fontWeight: {
			light: 200,
			normal: 400,
			semibold: 600,
			bold: 800
		},
		fontSize: {
			base: [ "14px", "20px" ],
			xs: [ "10px", "16px" ],
			sm: [ "12px", "18px" ],
			lg: [ "16px", "24px" ],
			xl: [ "20px", "28px" ],
			"2xl": [ "24px", "32px" ],
			"3xl": [ "28px", "40px" ],
			"4xl": [ "32px", "44px" ],
			"5xl": [ "36px", "48px" ],
			"6xl": [ "48px", "60px" ],
			"7xl": [ "60px", "72px" ],
			"8xl": [ "72px", "90px" ]
		},
		fontFamily: {
			sans: [
				"Montserrat",
				"ui-sans-serif"
			],
			fjalla: "Fjalla One"
		},
		extend: {
			keyframes: {
				dash: {
					"0%": {
						"stroke-dasharray": "1, 150",
						"stroke-dashoffset": "0"
					},
					"50%": {
						"stroke-dasharray": "90, 150",
						"stroke-dashoffset": "-34"
					},
					"100%": {
						"stroke-dasharray": "90, 150",
						"stroke-dashoffset": "-124"
					}
				}
			},
			animation: {
				dash: "dash 1s ease-in-out infinite"
			},
			colors: {
				transparent: "transparent",
				current: "currentColor",
				dark: {
					DEFAULT: "#172B4D",
					100: "#5E6C84",
					200: "#505F79",
					300: "#42526E",
					400: "#344563",
					500: "#253858",
					600: "#172B4D",
					700: "#091E42"
				},
				light: {
					DEFAULT: "#F4F5F7",
					100: "#FFFFFF",
					200: "#FAFBFC",
					300: "#F4F5F7",
					400: "#EBECF0",
					500: "#DFE1E6",
					600: "#C1C7D0",
					700: "#B3BAC5"
				},
				alt: {
					DEFAULT: "#5243AA",
					100: "#EAE6FF",
					200: "#C0B6F2",
					300: "#998DD9",
					400: "#8777D9",
					500: "#6554C0",
					600: "#5243AA",
					700: "#403294"
				},
				info: {
					DEFAULT: "#00A3BF",
					100: "#E6FCFF",
					200: "#B3F5FF",
					300: "#79E2F2",
					400: "#00C7E6",
					500: "#00B8D9",
					600: "#00A3BF",
					700: "#008DA6"
				},
				warning: {
					DEFAULT: "#FF991F",
					100: "#FFFAE6",
					200: "#FFF0B3",
					300: "#FFE380",
					400: "#FFC400",
					500: "#FFAB00",
					600: "#FF991F",
					700: "#FF8B00"
				},
				danger: {
					DEFAULT: "#DE350B",
					100: "#FFEBE6",
					200: "#FFBDAD",
					300: "#FF8F73",
					400: "#FF7452",
					500: "#FF5630",
					600: "#DE350B",
					700: "#BF2600"
				},
				success: {
					DEFAULT: "#00875A",
					100: "#E3FCEF",
					200: "#ABF5D1",
					300: "#79F2C0",
					400: "#57D9A3",
					500: "#36B37E",
					600: "#00875A",
					700: "#006644"
				},
				primary: {
					DEFAULT: "#0052CC",
					100: "#DEEBFF",
					200: "#B3D4FF",
					300: "#4C9AFF",
					400: "#2684FF",
					500: "#0065FF",
					600: "#0052CC",
					700: "#0747A6"
				}
			}
		}
	},
	plugins: []
}