CREATE TYPE "public"."event_priority" AS ENUM('normal', 'exam');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'pending_review', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audience_type" AS ENUM('public', 'role', 'department');--> statement-breakpoint
CREATE TYPE "public"."blackout_scope" AS ENUM('school', 'department');--> statement-breakpoint
CREATE TABLE "room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"room_id" uuid,
	"organizer_user_id" uuid,
	"dept_id" uuid,
	"priority" "event_priority" DEFAULT 'normal' NOT NULL,
	"status" "event_status" DEFAULT 'published' NOT NULL,
	"rrule" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_occurrence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_audience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"audience_type" "audience_type" NOT NULL,
	"audience_ref" text
);
--> statement-breakpoint
CREATE TABLE "blackout_window" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"scope" "blackout_scope" NOT NULL,
	"dept_id" uuid,
	"is_hard" boolean DEFAULT true NOT NULL,
	"rrule" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_organizer_user_id_users_id_fk" FOREIGN KEY ("organizer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrence" ADD CONSTRAINT "event_occurrence_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_audience" ADD CONSTRAINT "event_audience_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blackout_window" ADD CONSTRAINT "blackout_window_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_occurrence_start_at_idx" ON "event_occurrence" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "event_occurrence_event_id_idx" ON "event_occurrence" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_audience_event_id_idx" ON "event_audience" USING btree ("event_id");
