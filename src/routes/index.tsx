import { HomePage } from "@/shared/components/home-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/" )( {
	component: HomePage
} );
