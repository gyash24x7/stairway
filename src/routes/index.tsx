import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/" )( {
	component: () => (
		<div className={ "text-6xl" }>
			Hello, World
		</div>
	)
} );
