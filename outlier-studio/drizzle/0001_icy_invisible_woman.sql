CREATE TABLE "channel_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subscriber_count" bigint,
	"view_count" bigint,
	"video_count" integer
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"handle" text,
	"title" text NOT NULL,
	"thumbnail_url" text,
	"uploads_playlist_id" text,
	"subscriber_count" bigint,
	"view_count" bigint,
	"video_count" integer,
	"median_short_views" bigint,
	"median_long_views" bigint,
	"last_checked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_channels" (
	"user_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_channels_user_id_channel_id_pk" PRIMARY KEY("user_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "video_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" bigint,
	"like_count" bigint,
	"comment_count" bigint
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer,
	"is_short" boolean DEFAULT false NOT NULL,
	"thumbnail_url" text,
	"view_count" bigint,
	"like_count" bigint,
	"comment_count" bigint,
	"outlier_multiple" double precision,
	"views_per_hour" double precision,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "video_id" uuid;--> statement-breakpoint
ALTER TABLE "channel_snapshots" ADD CONSTRAINT "channel_snapshots_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_channels" ADD CONSTRAINT "tracked_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_channels" ADD CONSTRAINT "tracked_channels_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_snapshots" ADD CONSTRAINT "video_snapshots_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_snapshots_channel_taken_idx" ON "channel_snapshots" USING btree ("channel_id","taken_at");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_platform_external_idx" ON "channels" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "channels_last_checked_idx" ON "channels" USING btree ("last_checked_at");--> statement-breakpoint
CREATE INDEX "tracked_channels_channel_idx" ON "tracked_channels" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "video_snapshots_video_taken_idx" ON "video_snapshots" USING btree ("video_id","taken_at");--> statement-breakpoint
CREATE UNIQUE INDEX "videos_channel_external_idx" ON "videos" USING btree ("channel_id","external_id");--> statement-breakpoint
CREATE INDEX "videos_channel_published_idx" ON "videos" USING btree ("channel_id","published_at");--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generations_video_idx" ON "generations" USING btree ("video_id");