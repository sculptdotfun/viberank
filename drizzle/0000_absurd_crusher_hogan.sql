CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"total_submissions" integer DEFAULT 0 NOT NULL,
	"best_submission" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"total_tokens" integer NOT NULL,
	"total_cost" numeric(10, 4) NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cache_creation_tokens" integer NOT NULL,
	"cache_read_tokens" integer NOT NULL,
	"date_range" jsonb NOT NULL,
	"models_used" jsonb NOT NULL,
	"daily_breakdown" jsonb NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"source" text,
	"flagged_for_review" boolean DEFAULT false,
	"flag_reasons" jsonb
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_best_submission_submissions_id_fk" FOREIGN KEY ("best_submission") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_username_idx" ON "profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "profiles_email_idx" ON "profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "submissions_total_cost_idx" ON "submissions" USING btree ("total_cost");--> statement-breakpoint
CREATE INDEX "submissions_total_tokens_idx" ON "submissions" USING btree ("total_tokens");--> statement-breakpoint
CREATE INDEX "submissions_submitted_at_idx" ON "submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "submissions_username_idx" ON "submissions" USING btree ("username");--> statement-breakpoint
CREATE INDEX "submissions_email_idx" ON "submissions" USING btree ("email");