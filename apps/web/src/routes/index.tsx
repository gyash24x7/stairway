import { ApplicationCard } from "@main/components";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/" )( {
	component: () => (
		<div className={ "flex gap-5 flex-col md:flex-row" }>
			<ApplicationCard name={ "literature" } path={ "/literature" }/>
			<ApplicationCard name={ "wordle" } path={ "/wordle" }/>
			<ApplicationCard name={ "callbreak" } path={ "/callbreak" }/>
		</div>
	)
} );
