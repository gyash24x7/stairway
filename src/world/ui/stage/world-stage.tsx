import { Application, extend, useApplication, useTick } from "@pixi/react";
import type { FederatedPointerEvent, Graphics as PixiGraphics, Ticker } from "pixi.js";
import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { useEffect, useRef, useState } from "react";

import { GAMES } from "@/shared/games";
import type { Pos } from "@/world/map";
import { TILE_SIZE, tileAt, WORLD } from "@/world/map";
import type { Meeple } from "@/world/schema";
import type { Bubble } from "@/world/ui/connection";
import type { Palette } from "@/world/ui/stage/palette";


extend( { Container, Graphics, Sprite, Text } );

const T = TILE_SIZE;
/** Matches the client's step interval, so a held key reads as continuous walking. */
const WALK_PX_PER_MS = T / 120;
/** Further than this and an avatar jumps rather than walks — a correction or a respawn. */
const SNAP_DISTANCE = T * 3;
const AVATAR_RADIUS = T * 0.42;

const centre = ( pos: Pos ) => ( { x: pos.x * T + T / 2, y: pos.y * T + T / 2 } );


// --- Map ------------------------------------------------------------------

function MapLayer( { palette, tableLabels }: {
	palette: Palette;
	tableLabels: ReadonlyMap<string, string>;
} ) {
	const draw = ( g: PixiGraphics ) => {
		g.clear();
		g.rect( 0, 0, WORLD.width * T, WORLD.height * T ).fill( palette.surface );

		WORLD.rooms.forEach( ( room, i ) => {
			const { x0, y0, x1, y1 } = room.bounds;
			g.rect( x0 * T, y0 * T, ( x1 - x0 + 1 ) * T, ( y1 - y0 + 1 ) * T )
				.fill( { color: palette.rooms[ i % palette.rooms.length ]!, alpha: 0.28 } );
		} );

		for ( let y = 0; y < WORLD.height; y++ ) {
			for ( let x = 0; x < WORLD.width; x++ ) {
				const tile = tileAt( { x, y } );
				if ( tile === "wall" ) {
					g.rect( x * T, y * T, T, T ).fill( palette.outline );
				} else if ( tile === "door" ) {
					g.rect( x * T + 2, y * T, T - 4, T ).fill( palette.background );
				} else if ( tile === "table" ) {
					g.roundRect( x * T + 3, y * T + 3, T - 6, T - 6, 6 )
						.fill( palette.accent )
						.stroke( { color: palette.outline, width: 2 } );
				} else if ( tile === "plant" ) {
					g.circle( x * T + T / 2, y * T + T / 2, T * 0.36 )
						.fill( palette.plant )
						.stroke( { color: palette.outline, width: 2 } );
				}
			}
		}
	};

	return (
		<pixiContainer>
			<pixiGraphics draw={ draw }/>
			{ WORLD.rooms.map( room => {
				const label = room.game ? GAMES[ room.game ].title : "LOUNGE";
				return (
					<pixiText
						key={ `${ room.door.x },${ room.door.y }` }
						text={ label }
						anchor={ 0.5 }
						x={ ( room.bounds.x0 + room.bounds.x1 + 1 ) / 2 * T }
						// Always the top row: the bottom edge of the screen is where the chat box sits.
						y={ ( room.bounds.y0 + 0.5 ) * T }
						style={ { fontFamily: "Bungee", fontSize: 14, fill: palette.foreground } }
					/>
				);
			} ) }
			{ Array.from( tableLabels, ( [ key, label ] ) => {
				const [ x, y ] = key.split( "," ).map( Number );
				return (
					<pixiText
						key={ key }
						text={ label }
						anchor={ 0.5 }
						x={ x! * T + T / 2 }
						y={ y! * T + T / 2 }
						style={ {
							fontFamily: "Oswald",
							fontSize: 12,
							fontWeight: "700",
							fill: palette.foreground
						} }
					/>
				);
			} ) }
		</pixiContainer>
	);
}


// --- Avatars --------------------------------------------------------------

const textures = new Map<string, Promise<Texture | undefined>>();

/**
 * Loads an avatar picture as a texture. Each URL is fetched once and reused.
 * A picture that fails to load (offline, or the CDN refusing CORS) falls back
 * to the coloured disc, so an avatar never fails to draw.
 */
function useAvatarTexture( url: string ) {
	const [ texture, setTexture ] = useState<Texture>();

	useEffect( () => {
		let live = true;
		let promise = textures.get( url );
		if ( !promise ) {
			promise = new Promise( resolve => {
				const img = new Image();
				img.crossOrigin = "anonymous";
				img.onload = () => resolve( Texture.from( img ) );
				img.onerror = () => resolve( undefined );
				img.src = url;
			} );
			textures.set( url, promise );
		}
		void promise.then( t => live && setTexture( t ) );
		return () => {
			live = false;
		};
	}, [ url ] );

	return texture;
}

const hue = ( id: string ) => {
	let h = 0;
	for ( const c of id ) {
		h = ( h * 31 + c.charCodeAt( 0 ) ) >>> 0;
	}
	return `hsl(${ h % 360 }, 70%, 62%)`;
};

type AvatarNodeProps = {
	avatar: Meeple;
	isSelf: boolean;
	bubble: Bubble | undefined;
	palette: Palette;
	/** Called with this avatar's on-screen position every frame, for the camera to follow. */
	onFrame?: ( at: { x: number; y: number } ) => void;
};

function AvatarNode( { avatar, isSelf, bubble, palette, onFrame }: AvatarNodeProps ) {
	const ref = useRef<Container>( null );
	const shown = useRef( centre( avatar.pos ) );
	const texture = useAvatarTexture( avatar.avatar );

	useTick( ( ticker: Ticker ) => {
		const target = centre( avatar.pos );
		const at = shown.current;
		const dx = target.x - at.x;
		const dy = target.y - at.y;
		const distance = Math.hypot( dx, dy );
		const stride = WALK_PX_PER_MS * ticker.deltaMS;

		if ( distance > SNAP_DISTANCE || distance <= stride ) {
			shown.current = target;
		} else {
			shown.current = { x: at.x + dx / distance * stride, y: at.y + dy / distance * stride };
		}

		ref.current?.position.set( shown.current.x, shown.current.y );
		onFrame?.( shown.current );
	} );

	const ring = isSelf ? palette.accent : palette.outline;
	const drawDisc = ( g: PixiGraphics ) => {
		g.clear();
		g.ellipse( 0, AVATAR_RADIUS * 0.9, AVATAR_RADIUS * 0.8, AVATAR_RADIUS * 0.3 )
			.fill( { color: "#000000", alpha: 0.18 } );
		g.circle( 0, 0, AVATAR_RADIUS ).fill( texture ? palette.background : hue( avatar.userId ) );
	};
	const drawRing = ( g: PixiGraphics ) => {
		g.clear();
		g.circle( 0, 0, AVATAR_RADIUS ).stroke( { color: ring, width: isSelf ? 3 : 2 } );
		if ( avatar.status === "playing" ) {
			g.circle( AVATAR_RADIUS * 0.75, -AVATAR_RADIUS * 0.75, 5 )
				.fill( palette.rooms[ 0 ]! )
				.stroke( { color: palette.outline, width: 1.5 } );
		}
	};
	const drawBubble = ( g: PixiGraphics, width: number ) => {
		g.clear();
		g.roundRect( -width / 2, -AVATAR_RADIUS - 42, width, 24, 8 )
			.fill( palette.background )
			.stroke( { color: palette.outline, width: 2 } );
	};

	const label = avatar.name;
	const bubbleText = bubble &&
		( bubble.text.length > 30 ? `${ bubble.text.slice( 0, 29 ) }…` : bubble.text );
	const bubbleWidth = bubbleText ? bubbleText.length * 7 + 16 : 0;

	return (
		<pixiContainer ref={ ref } zIndex={ avatar.pos.y }>
			<pixiGraphics draw={ drawDisc }/>
			{ texture && (
				<pixiSprite
					texture={ texture }
					anchor={ 0.5 }
					width={ AVATAR_RADIUS * 2 }
					height={ AVATAR_RADIUS * 2 }
				/>
			) }
			<pixiGraphics draw={ drawRing }/>
			<pixiText
				text={ label }
				anchor={ { x: 0.5, y: 0 } }
				y={ AVATAR_RADIUS + 2 }
				style={ {
					fontFamily: "Oswald",
					fontSize: 11,
					fontWeight: "700",
					fill: palette.foreground,
					stroke: { color: palette.surface, width: 3 }
				} }
			/>
			{ bubbleText && (
				<pixiContainer>
					<pixiGraphics draw={ g => drawBubble( g, bubbleWidth ) }/>
					<pixiText
						text={ bubbleText }
						anchor={ 0.5 }
						y={ -AVATAR_RADIUS - 30 }
						style={ { fontFamily: "Merriweather Sans", fontSize: 11, fill: palette.foreground } }
					/>
				</pixiContainer>
			) }
		</pixiContainer>
	);
}


// --- Camera ---------------------------------------------------------------

type SceneProps = {
	self: Meeple;
	others: ReadonlyArray<Meeple>;
	bubbles: ReadonlyMap<string, Bubble>;
	palette: Palette;
	tableLabels: ReadonlyMap<string, string>;
	onTileClick: ( pos: Pos ) => void;
};

/**
 * Keeps your own avatar in the middle of the screen. Near the map's edges it
 * stops scrolling instead, so the screen never shows space outside the map.
 * A map smaller than the screen is centred.
 */
function Scene( { self, others, bubbles, palette, tableLabels, onTileClick }: SceneProps ) {
	const { app } = useApplication();
	const world = useRef<Container>( null );
	const focus = useRef( centre( self.pos ) );

	useTick( () => {
		const view = world.current;
		if ( !view ) {
			return;
		}
		const { width, height } = app.screen;
		const clamp = ( screen: number, size: number, at: number ) =>
			size <= screen ? ( screen - size ) / 2 : Math.min(
				0,
				Math.max( screen - size, screen / 2 - at )
			);
		view.position.set(
			Math.round( clamp( width, WORLD.width * T, focus.current.x ) ),
			Math.round( clamp( height, WORLD.height * T, focus.current.y ) )
		);
	} );

	const handleTap = ( event: FederatedPointerEvent ) => {
		const view = world.current;
		if ( !view ) {
			return;
		}
		const local = view.toLocal( event.global );
		onTileClick( { x: Math.floor( local.x / T ), y: Math.floor( local.y / T ) } );
	};

	return (
		<pixiContainer
			ref={ world }
			eventMode={ "static" }
			onPointerTap={ handleTap }
			sortableChildren
		>
			<MapLayer palette={ palette } tableLabels={ tableLabels }/>
			{ others.map( avatar => (
				<AvatarNode
					key={ avatar.connId }
					avatar={ avatar }
					isSelf={ false }
					bubble={ bubbles.get( avatar.connId ) }
					palette={ palette }
				/>
			) ) }
			<AvatarNode
				key={ self.connId }
				avatar={ self }
				isSelf
				bubble={ bubbles.get( self.connId ) }
				palette={ palette }
				onFrame={ at => {
					focus.current = at;
				} }
			/>
		</pixiContainer>
	);
}

export type WorldStageProps = SceneProps;

export function WorldStage( props: WorldStageProps ) {
	const wrapper = useRef<HTMLDivElement>( null );

	return (
		<div ref={ wrapper } className={ "absolute inset-0" }>
			<Application resizeTo={ wrapper } backgroundAlpha={ 0 } antialias autoDensity
									 resolution={ window.devicePixelRatio }>
				<Scene { ...props }/>
			</Application>
		</div>
	);
}
