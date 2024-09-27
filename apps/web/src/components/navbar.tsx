import { Route } from "@/routes/__root.tsx";
import { cn } from "@base/components";
import { Tabs, TabsList, TabsTrigger } from "@base/components/src/tabs.tsx";
import { useLocation } from "@tanstack/react-router";

const randomBg = () => {
	const bgs = [ "bg-yellow-500", "bg-red-500", "bg-blue-500", "bg-green-500", "bg-pink-500 " ];
	return bgs[ Math.floor( Math.random() * 5 ) ];
};

export const Navbar = () => {
	const navigate = Route.useNavigate();
	const { pathname } = useLocation();

	return (
		<div
			className={ cn(
				"flex flex-col gap-3 items-center justify-between border-b-4",
				"py-5 px-3 md:px-5 fixed z-20 bg-background left-0 right-0"
			) }
		>
			<div className={ "flex gap-1 lg:gap-2 justify-center items-center font-bold" }>
				{ "stairway".split( "" ).map( ( letter, index ) => (
					<div
						key={ index }
						className={
							cn(
								"text-xl w-9 h-9 flex items-center justify-center",
								"md:text-2xl md:w-12 md:h-12",
								"lg:text-3xl lg:w-16 lg:h-16 lg:border-4",
								"xl:text-5xl xl:w-20 xl:h-20",
								"border-gray-800 border-2 rounded-md",
								randomBg()
							)
						}
					>
						{ letter.toUpperCase() }
					</div>
				) ) }
			</div>
			<Tabs defaultValue="home" className={ "w-full" } value={ pathname.split( "/" )[ 1 ] }>
				<TabsList className="grid grid-cols-2 lg:grid-cols-4 font-semibold text-muted-foreground h-10">
					<TabsTrigger
						value=""
						onClick={ () => navigate( { to: "/" } ) }
						className={ "h-8 lg:col-start-2 lg:col-end-3" }
					>
						HOME
					</TabsTrigger>
					<TabsTrigger
						value="settings"
						onClick={ () => navigate( { to: "/settings" } ) }
						className={ "h-8 lg:col-start-3 lg:col-end-4" }
					>
						SETTINGS
					</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
};