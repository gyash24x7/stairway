import { ApplicationCard } from "@main/ui";

export default function Home() {
	return (
		<div className={ "flex gap-10 flex-col md:flex-row mt-2" }>
			<ApplicationCard name={ "literature" } path={ "/literature" }/>
			<ApplicationCard name={ "wordle" } path={ "/wordle" }/>
		</div>
	);
}
