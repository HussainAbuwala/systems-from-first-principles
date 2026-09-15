ALTER TABLE `allocations` ADD `quantity` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `quantity` integer DEFAULT 1 NOT NULL;