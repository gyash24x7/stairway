import { ApplicationCard } from "@/shared/components/application-card";

export async function Home() {
	return (
		<div className={ "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5" }>
			<ApplicationCard name={ "literature" } path={ "/literature" }/>
			<ApplicationCard name={ "wordle" } path={ "/wordle" }/>
			<ApplicationCard name={ "callbreak" } path={ "/callbreak" }/>
		</div>
	);
}