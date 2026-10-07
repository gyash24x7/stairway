import { defineRailway, github, postgres, project, redis, service } from "railway/iac";


/**
 * The whole Railway project: one app service plus the Postgres and Redis it
 * runs on. Railway does not read this file on deploy — `railway config plan`
 * previews it against the linked project and `railway config apply` makes it so.
 * Pushes to `main` still deploy on their own; this file only shapes the services.
 *
 * Not declared here, because IaC does not manage it: the generated
 * `*.up.railway.app` domain. Generate it once on the service's Networking tab,
 * targeting port 8080, before the first deploy — the passkey variables below
 * resolve against it.
 */
export default defineRailway( () => {
	const db = postgres( "postgres" );
	const cache = redis( "redis" );

	const app = service( "stairway", {
		source: github( "gyash24x7/stairway", { branch: "main", checkSuites: true } ),
		build: "bun run build",
		start: "bun run start",
		preDeploy: "bun run db:migrate",
		healthcheck: "/api/health/check",
		healthcheckTimeout: 120,
		replicas: 1,
		env: {
			PORT: "8080",
			DATABASE_URL: db.env.DATABASE_URL,
			REDIS_URL: cache.env.REDIS_URL,
			WEBAUTHN_RP_ID: "${{RAILWAY_PUBLIC_DOMAIN}}",
			WEBAUTHN_RP_ORIGIN: "https://${{RAILWAY_PUBLIC_DOMAIN}}"
		},
		domains: [ { domain: "stairway.yashgupta.me", port: 8080 } ]
	} );

	return project( "stairway", { resources: [ app, db, cache ] } );
} );
