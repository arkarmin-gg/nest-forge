import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Scope unique constraints to active (non-deleted) rows.
 *
 * TypeORM's @DeleteDateColumn() soft-deletes rows and auto-excludes them from
 * reads, but the original unconditional UNIQUE constraints still counted
 * soft-deleted rows — so reusing a deleted record's unique value (e.g. a phone
 * after account deletion) raised `duplicate key value violates unique
 * constraint`. Replacing each constraint with a partial unique index
 * (WHERE "deletedAt" IS NULL) lets deleted rows hold stale values while keeping
 * active rows unique. See docs/adr/0007-partial-unique-indexes-for-soft-delete.md.
 */
export class PartialUniqueSoftDelete1781200000000 implements MigrationInterface {
  name = 'PartialUniqueSoftDelete1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_a000cca60bcf04454e727699490"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_f382af58ab36057334fb262efd5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_60cea0d80c39eedaaaf5e21f175"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_phone_active" ON "users" ("phone") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_googleId_active" ON "users" ("googleId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_appleId_active" ON "users" ("appleId") WHERE "deletedAt" IS NULL`,
    );

    // Admins
    await queryRunner.query(
      `ALTER TABLE "admins" DROP CONSTRAINT "UQ_051db7d37d478a69a7432df1479"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_admins_email_active" ON "admins" ("email") WHERE "deletedAt" IS NULL`,
    );

    // Roles
    await queryRunner.query(
      `ALTER TABLE "roles" DROP CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_roles_name_active" ON "roles" ("name") WHERE "deletedAt" IS NULL`,
    );

    // Modules
    await queryRunner.query(
      `ALTER TABLE "modules" DROP CONSTRAINT "UQ_25b42b11ac8b697cdb2eddcef1a"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_modules_code_active" ON "modules" ("code") WHERE "deletedAt" IS NULL`,
    );

    // Settings
    await queryRunner.query(
      `ALTER TABLE "settings" DROP CONSTRAINT "UQ_c8639b7626fa94ba8265628f214"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_settings_key_active" ON "settings" ("key") WHERE "deletedAt" IS NULL`,
    );

    // Permissions (was a unique index, not a table constraint)
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d08be7a97addd61b394eba245c"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_permissions_module_action_active" ON "permissions" ("moduleId", "action") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Permissions
    await queryRunner.query(
      `DROP INDEX "public"."UQ_permissions_module_action_active"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d08be7a97addd61b394eba245c" ON "permissions" ("moduleId", "action")`,
    );

    // Settings
    await queryRunner.query(`DROP INDEX "public"."UQ_settings_key_active"`);
    await queryRunner.query(
      `ALTER TABLE "settings" ADD CONSTRAINT "UQ_c8639b7626fa94ba8265628f214" UNIQUE ("key")`,
    );

    // Modules
    await queryRunner.query(`DROP INDEX "public"."UQ_modules_code_active"`);
    await queryRunner.query(
      `ALTER TABLE "modules" ADD CONSTRAINT "UQ_25b42b11ac8b697cdb2eddcef1a" UNIQUE ("code")`,
    );

    // Roles
    await queryRunner.query(`DROP INDEX "public"."UQ_roles_name_active"`);
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name")`,
    );

    // Admins
    await queryRunner.query(`DROP INDEX "public"."UQ_admins_email_active"`);
    await queryRunner.query(
      `ALTER TABLE "admins" ADD CONSTRAINT "UQ_051db7d37d478a69a7432df1479" UNIQUE ("email")`,
    );

    // Users
    await queryRunner.query(`DROP INDEX "public"."UQ_users_appleId_active"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_googleId_active"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_phone_active"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_60cea0d80c39eedaaaf5e21f175" UNIQUE ("appleId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_f382af58ab36057334fb262efd5" UNIQUE ("googleId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone")`,
    );
  }
}
