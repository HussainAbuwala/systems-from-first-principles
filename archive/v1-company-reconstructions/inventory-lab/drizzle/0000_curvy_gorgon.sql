CREATE TABLE `allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`buyer` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_allocations_experiment_id` ON `allocations` (`experiment_id`);--> statement-breakpoint
CREATE TABLE `experiment_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`experiment_id` text NOT NULL,
	`buyer` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_experiment_events_experiment_id_id` ON `experiment_events` (`experiment_id`,`id`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`initial_stock` integer NOT NULL,
	`available` integer NOT NULL,
	`created_at` integer NOT NULL
);
