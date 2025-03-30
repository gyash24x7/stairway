import { cn } from "@/utils/cn";
import { fjalla } from "@/utils/fonts";

const stairway = "stairway".split( "" ).map( ( letter ) => {
	return { letter, bg: [ "bg-main", "bg-bg" ][ Math.floor( Math.random() * 2 ) ] };
} );

export function Logo() {

	return (
		<div
			className={ cn(
				"flex gap-1 lg:gap-2 justify-center items-center font-bold",
				"w-full py-5 px-3 md:px-5 border-b-4"
			) }
		>
			{ stairway.map( ( { letter, bg }, index ) => (
				<div
					key={ index }
					className={
						cn(
							"text-xl w-9 h-9 flex items-center justify-center",
							"md:text-2xl md:w-12 md:h-12",
							"lg:text-3xl lg:w-16 lg:h-16 lg:border-4",
							"xl:text-5xl xl:w-20 xl:h-20",
							"border-gray-800 border-2 rounded-md",
							fjalla.className,
							bg
						)
					}
				>
					{ letter.toUpperCase() }
				</div>
			) ) }
		</div>
	);
}