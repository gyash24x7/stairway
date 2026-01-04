export function GameCompleted() {
	return (
		<div className={ "flex flex-col gap-3" }>
			<div className={ "border-2 rounded-md bg-accent text-neutral-dark" }>
				<p className={ "font-semibold lg:text-6xl text-4xl text-center p-3" }>
					Game&nbsp;Completed
				</p>
			</div>
		</div>
	);
}