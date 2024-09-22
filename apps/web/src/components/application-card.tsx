import { Button, cn } from "@base/ui";
import { Link } from "@tanstack/react-router";

export type ApplicationCardProps = {
	name: string;
	path: string;
}

export const ApplicationCard = ( props: ApplicationCardProps ) => (
	<div className="group/card">
		<div
			className={ cn(
				"cursor-pointer overflow-hidden relative card h-96 rounded-md flex flex-col justify-between p-6",
				`backgroundImage ${ props.name }-bg bg-cover border border-gray-500 w-full min-w-80`
			) }
		>
			<div
				className={ cn(
					"absolute w-full h-full top-0 left-0 transition duration-300",
					"bg-white dark:bg-black opacity-30"
				) }
			/>
			<div
				className={ cn(
					"absolute w-full h-full top-0 left-0 transition duration-300",
					"group-hover/card:bg-white dark:group-hover/card:bg-black opacity-60"
				) }
			/>
			<div>
				<p className={ "font-bold text-sm relative z-10" }>GAMES</p>
				<h1 className={ `font-bold text-5xl relative z-10 font-fjalla` }>
					{ props.name.toUpperCase() }
				</h1>
			</div>
			<div className={ "flex justify-end z-10" }>
				<Link to={ props.path }>
					<Button>PLAY</Button>
				</Link>
			</div>
		</div>
	</div>
);
