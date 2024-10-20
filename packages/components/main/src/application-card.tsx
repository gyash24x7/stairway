import { Button, cn, fjalla } from "@stairway/components/base";
import Link from "next/link";

export type ApplicationCardProps = {
	name: string;
	path: string;
}

export const ApplicationCard = ( props: ApplicationCardProps ) => (
	<div
		className={ cn(
			"cursor-pointer overflow-hidden relative card min-w-xl h-64 md:h-96 rounded-md flex flex-col",
			`justify-between backgroundImage ${ props.name }-bg bg-cover border-2 flex-1`
		) }
	>
		<div
			className={ cn(
				"absolute w-full h-full top-0 left-0 transition duration-300",
				"bg-white dark:bg-black opacity-30"
			) }
		/>
		<div className={ "bg-primary px-6 py-3 mt-6" }>
			<p className={ "font-semibold text-sm relative z-10 text-primary-foreground" }>GAMES</p>
			<h1 className={ `font-bold text-5xl relative z-10 ${ fjalla.className } text-primary-foreground` }>
				{ props.name.toUpperCase() }
			</h1>
		</div>
		<div className={ "flex justify-end z-10 p-6" }>
			<Link href={ props.path }>
				<Button>PLAY</Button>
			</Link>
		</div>
	</div>
);
