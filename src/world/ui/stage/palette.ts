import { useEffect, useState } from "react";


/**
 * The theme's colours, read off `<body>` for Pixi.
 *
 * Pixi draws on a canvas, so Tailwind classes cannot style it. Instead this
 * reads the same CSS variables the classes resolve to, so the world follows
 * the selected theme. The theme switcher changes classes on `<body>`, and an
 * observer re-reads the variables whenever that happens.
 */
export type Palette = {
	readonly surface: string;
	readonly background: string;
	readonly foreground: string;
	readonly outline: string;
	readonly accent: string;
	/** One colour per room slot, in map order. */
	readonly rooms: ReadonlyArray<string>;
	readonly plant: string;
};

const ROOM_COLOURS = [
	"apple",
	"orange",
	"mango",
	"kiwi",
	"ice",
	"blueberry",
	"grape",
	"strawberry"
];

const read = (): Palette => {
	const style = getComputedStyle( document.body );
	const v = ( name: string, fallback: string ) => style.getPropertyValue( `--${ name }` ).trim() ||
		fallback;
	return {
		surface: v( "surface", "#F3F4F6" ),
		background: v( "background", "#FFFFFF" ),
		foreground: v( "foreground", "#1F1F1F" ),
		outline: v( "inverted-surface", "#1F1F1F" ),
		accent: v( "accent", "#808080" ),
		rooms: ROOM_COLOURS.map( name => v( name, "#808080" ) ),
		plant: v( "olive", "#A4C639" )
	};
};

export function usePalette(): Palette {
	const [ palette, setPalette ] = useState( read );

	useEffect( () => {
		const observer = new MutationObserver( () => setPalette( read() ) );
		observer.observe( document.body, { attributes: true, attributeFilter: [ "class" ] } );
		return () => observer.disconnect();
	}, [] );

	return palette;
}
