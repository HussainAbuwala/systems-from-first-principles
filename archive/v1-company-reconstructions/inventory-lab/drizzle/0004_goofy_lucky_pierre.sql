CREATE TABLE `reservation_commands` (
	`event_key` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`reservation_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reservation_commands_reservation` ON `reservation_commands` (`experiment_id`,`reservation_id`);