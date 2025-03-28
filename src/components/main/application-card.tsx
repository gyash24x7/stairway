import { Button } from "@/components/base/button";
import { cn } from "@/utils/cn";
import { fjalla } from "@/utils/fonts";
import Link from "next/link";

export type ApplicationCardProps = {
	name: string;
	path: string;
}

export function ApplicationCard( props: ApplicationCardProps ) {
	return (
		<div
			className={ cn(
				"cursor-pointer overflow-hidden relative card h-64 md:h-96 rounded-md flex flex-col",
				`justify-between backgroundImage ${ props.name }-bg bg-cover border-2 flex-1`,
				fjalla.className
			) }
		>
			<div
				className={ cn(
					"absolute w-full h-full top-0 left-0 transition duration-300",
					"bg-white opacity-30"
				) }
			/>
			<div className={ "bg-primary px-6 py-3 mt-6" }>
				<h1 className={ `text-5xl relative z-10 text-primary-foreground` }>
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
}
