import { Fjalla_One, Montserrat } from "next/font/google";

export const fjalla = Fjalla_One( {
	subsets: [ "latin" ],
	weight: "400"
} );

export const montserrat = Montserrat( {
	subsets: [ "latin" ],
	weight: [ "400", "600", "800" ]
} );