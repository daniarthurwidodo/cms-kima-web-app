CREATE TABLE "renungan_daily" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"scripture_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_renungan_daily_date" ON "renungan_daily" USING btree ("date");