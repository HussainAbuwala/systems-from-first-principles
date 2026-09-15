CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`buyer` text NOT NULL,
	`status` text NOT NULL,
	`expires_at` integer,
	`abandoned_at` integer,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_reservations_experiment_status` ON `reservations` (`experiment_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_reservations_expiry` ON `reservations` (`status`,`expires_at`);