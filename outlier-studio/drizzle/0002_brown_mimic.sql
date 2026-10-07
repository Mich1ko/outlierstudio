ALTER TABLE "channels" ADD COLUMN "monitored" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
ALTER TABLE "tracked_channels" ADD COLUMN "is_own" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "persona" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "transcript" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "transcript_lang" text;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;