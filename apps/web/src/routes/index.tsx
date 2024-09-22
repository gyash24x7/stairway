import { ApplicationCard } from "@/components/application-card.tsx";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/" )( {
	component: () => (
		<div className={ "flex gap-10 flex-col md:flex-row mt-2" }>
			<ApplicationCard name={ "literature" } path={ "/literature" }/>
			<ApplicationCard name={ "wordle" } path={ "/wordle" }/>
		</div>
	)
} );
