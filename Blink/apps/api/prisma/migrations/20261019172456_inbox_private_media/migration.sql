-- AlterTable
ALTER TABLE `message` ADD COLUMN `isPrivate` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mediaMime` VARCHAR(191) NULL,
    ADD COLUMN `mediaType` VARCHAR(191) NULL,
    ADD COLUMN `privateOpenedAt` DATETIME(3) NULL;
