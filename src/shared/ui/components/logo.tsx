export function Logo( props: { url: string; classname?: string } ) {
	return (
		<div
			className={ props.classname }
			style={ {
				maskImage: `url(${ props.url })`,
				maskSize: "contain",
				maskRepeat: "no-repeat",
				maskPosition: "center",
				WebkitMaskImage: `url(${ props.url })`,
				WebkitMaskSize: "contain",
				WebkitMaskRepeat: "no-repeat",
				WebkitMaskPosition: "center"
			} }
		/>
	);
}
