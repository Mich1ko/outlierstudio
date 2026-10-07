CREATE TABLE "apify_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"reserved_usd" double precision NOT NULL,
	"cost_usd" double precision,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "apify_runs_created_idx" ON "apify_runs" USING btree ("created_at");