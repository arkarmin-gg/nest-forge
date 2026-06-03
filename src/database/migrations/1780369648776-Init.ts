import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1780369648776 implements MigrationInterface {
    name = 'Init1780369648776'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admins" RENAME COLUMN "twoFactorEnabled" TO "isTwoFactorEnabled"`);
        await queryRunner.query(`ALTER TABLE "roles" ADD "rank" integer NOT NULL DEFAULT '99'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "rank"`);
        await queryRunner.query(`ALTER TABLE "admins" RENAME COLUMN "isTwoFactorEnabled" TO "twoFactorEnabled"`);
    }

}
