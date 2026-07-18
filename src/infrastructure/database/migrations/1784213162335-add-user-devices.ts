import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDevices1784213162335 implements MigrationInterface {
  name = 'AddUserDevices1784213162335';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_devices" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, "device_id" character varying(128) NOT NULL, "fcm_token" text, "platform" character varying NOT NULL, "app_version" character varying(100), "device_model" character varying(255), "os_version" character varying(100), "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_user_devices_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e6a4e256204bd50b0053bf63bb" ON "user_devices" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_28bd79e1b3f7c1168f0904ce24" ON "user_devices" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_devices_user_last_seen" ON "user_devices" ("user_id", "last_seen_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_devices_user_device_active" ON "user_devices" ("user_id", "device_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" ADD CONSTRAINT "CHK_user_devices_platform" CHECK ("platform" IN ('IOS', 'ANDROID', 'WEB'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" ADD CONSTRAINT "FK_user_devices_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_devices" DROP CONSTRAINT "FK_user_devices_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" DROP CONSTRAINT "CHK_user_devices_platform"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_user_devices_user_device_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_devices_user_last_seen"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_28bd79e1b3f7c1168f0904ce24"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e6a4e256204bd50b0053bf63bb"`,
    );
    await queryRunner.query(`DROP TABLE "user_devices"`);
  }
}
