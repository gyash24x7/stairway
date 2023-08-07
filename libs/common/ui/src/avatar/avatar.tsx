import { useMemo } from "react";
import { Else, If, Then } from "react-if";
import { type Size, VariantSchema } from "../utils/index.js";

export interface AvatarProps {
	size?: Size;
	src?: string | null;
	name?: string | null;
}

const randomChar = () => {
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	return possible.charAt( Math.floor( Math.random() * 26 ) );
};

const initialsFromName = ( name: string | null | undefined ) => {
	if ( !name || name.trim().length === 0 ) {
		const initials = randomChar() + randomChar();
		return initials.toUpperCase();
	} else {
		const words = name.trim().split( " " );

		if ( words.length === 1 ) {
			if ( words[ 0 ].length > 1 ) {
				const initials = words[ 0 ].charAt( 0 ) + words[ 0 ].charAt( 1 );
				return initials.toUpperCase();
			} else {
				const initials = words[ 0 ].charAt( 0 ) + randomChar();
				return initials.toUpperCase();
			}
		} else {
			const initials = words[ 0 ].charAt( 0 ) + words[ 1 ].charAt( 0 );
			return initials.toUpperCase();
		}
	}
};

const avatarRootVariantSchema = new VariantSchema(
	"inline-flex rounded-full select-none",
	{
		size: {
			xs: "w-6 h-6",
			sm: "w-8 h-8",
			md: "w-10 h-10",
			lg: "w-12 h-12",
			xl: "w-16 h-16",
			"2xl": "w-20 h-20"
		}
	},
	{ size: "md" }
);

const avatarImageVariantSchema = new VariantSchema( "w-full h-full object-cover rounded-full", {}, {} );

const avatarDivVariantSchema = new VariantSchema(
	"w-full h-full flex items-center justify-center font-semibold rounded-full bg-alt-100 text-alt",
	{
		size: {
			xs: "text-xs",
			sm: "text-base",
			md: "text-lg",
			lg: "text-xl",
			xl: "text-2xl",
			"2xl": "text-3xl"
		}
	},
	{ size: "md" }
);

export function Avatar( { size, src, name }: AvatarProps ) {
	const rootClassname = useMemo( () => avatarRootVariantSchema.getClassname( { size } ), [ size ] );
	const imageClassname = useMemo( () => avatarImageVariantSchema.getClassname(), [] );
	const divClassname = useMemo( () => avatarDivVariantSchema.getClassname( { size } ), [ size ] );
	const initials = useMemo( () => initialsFromName( name ), [] );

	return (
		<div className={ rootClassname }>
			<If condition={ !!src }>
				<Then>
					<img src={ src! } alt={ "avatar-img" } className={ imageClassname }/>
				</Then>
				<Else>
					<div className={ divClassname }>{ initials }</div>
				</Else>
			</If>
		</div>
	);
}