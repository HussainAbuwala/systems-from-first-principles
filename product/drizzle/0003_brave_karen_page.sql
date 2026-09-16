ALTER TABLE `reservations` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reservations_experiment_idempotency` ON `reservations` (`experiment_id`,`idempotency_key`);