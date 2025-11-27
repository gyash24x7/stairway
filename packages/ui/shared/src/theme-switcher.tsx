"use client";

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from "@s2h-ui/primitives/select";
import { cn } from "@s2h-ui/primitives/utils";
import { Fragment, useEffect, useState } from "react";

const colors = {
	APPLE: [ "#ff6b6b", "#fcd7d7" ] as const,
	BANANA: [ "#ffdc58", "#fef2e8" ] as const,
	ORANGE: [ "#fd9745", "#fff4e0" ] as const,
	BLUEBERRY: [ "#0099ff", "#ddeffd" ] as const,
	KIWI: [ "#8ae600", "#e7f7cf" ] as const,
	GRAPES: [ "#a388ee", "#e3dff2" ] as const,
	MANGO: [ "#ffbf00", "#fef3c8" ] as const,
	ICE: [ "#00c8f0", "#cdf6fe" ] as const,
	STRAWBERRY: [ "#fc64ab", "#fce9f3" ] as const
};

export function ThemeSwitcher() {
	const [ theme, setTheme ] = useState<keyof typeof colors>( "APPLE" );

	useEffect( () => {
		const root = document.documentElement;
		const [ main, bg ] = colors[ theme ];
		root.style.setProperty( "--main", main );
		root.style.setProperty( "--background", bg );
	}, [ theme ] );

	return (
		<Select onValueChange={ ( value ) => setTheme( value as keyof typeof colors ) } value={ theme }>
			<SelectTrigger className={ cn( "w-[150px]", "h-8 md:h-10" ) }>
				<SelectValue/>
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					{ Object.keys( colors ).map( ( color ) => (
						<Fragment key={ color }>
							<SelectItem label={ color } value={ color }/>
							<SelectSeparator/>
						</Fragment>
					) ) }
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}