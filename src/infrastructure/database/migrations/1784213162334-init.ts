import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1784213162334 implements MigrationInterface {
  name = 'Init1784213162334';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "modules" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying NOT NULL, "code" character varying NOT NULL, "parent_id" uuid, CONSTRAINT "PK_7dbefd488bd96c5bf31f0ce0c95" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d233555396cba99afaab4868b6" ON "modules" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_modules_code_active" ON "modules" ("code") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "module_id" uuid NOT NULL, "action" character varying NOT NULL, CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ea42cae477fc1dc619a5cd280" ON "permissions" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_738f46bb9ac6ea356f1915835d" ON "permissions" ("module_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_permissions_module_action_active" ON "permissions" ("module_id", "action") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "role_permissions" ("role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "PK_25d24010f53bb80b78e412c9656" PRIMARY KEY ("role_id", "permission_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_25d24010f53bb80b78e412c965" ON "role_permissions" ("role_id", "permission_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying NOT NULL, "description" character varying, "rank" integer NOT NULL DEFAULT '99', CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7fd0c79dc4e6083ddea850ac38" ON "roles" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_roles_name_active" ON "roles" ("name") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "admins" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "full_name" character varying NOT NULL, "password" character varying, "email" character varying NOT NULL, "profile_image_key" character varying, "role_id" uuid NOT NULL, "is_banned" boolean NOT NULL DEFAULT false, "last_login_at" TIMESTAMP WITH TIME ZONE, "last_logout_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e3b38270c97a854c48d2e80874e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c6ef87dba2fe6e060a957fca9b" ON "admins" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4474a623b12e66592815dc8bba" ON "admins" ("full_name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5733c73cd81c566a90cc4802f9" ON "admins" ("role_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_07972025d2d8847474f45962cc" ON "admins" ("is_banned") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_admins_email_active" ON "admins" ("email") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "token_hash" text NOT NULL, "user_id" uuid, "admin_id" uuid, "expires_at" TIMESTAMP WITH TIME ZONE, "is_revoked" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ecd766716e82c2e0f1cf6cb628" ON "refresh_tokens" ("admin_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ba3bd69c8ad1e799c0256e9e50" ON "refresh_tokens" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9de861562a968206b3dac37bb9" ON "refresh_tokens" ("admin_id", "is_revoked") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_14187aa4d2d58318c82c62c7ea" ON "refresh_tokens" ("user_id", "is_revoked") `,
    );
    await queryRunner.query(
      `CREATE TABLE "otp_records" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, "admin_id" uuid, "status" character varying NOT NULL DEFAULT 'PENDING', "purpose" character varying NOT NULL, "code_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "request_id" character varying, "attempts" integer NOT NULL DEFAULT '0', "max_attempts" integer NOT NULL DEFAULT '3', CONSTRAINT "PK_3def88b3f662809c2c75f04e016" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2f19c4c5f1e1a61aea6f587758" ON "otp_records" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ad64c886530ff1b4bf0357a4f" ON "otp_records" ("admin_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d72060b2501b9ed4cd62e7ebc6" ON "otp_records" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e383daa23a6877fa31353a9fe9" ON "otp_records" ("admin_id", "purpose", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_466fbbc290957f89c78e9d18b2" ON "otp_records" ("user_id", "purpose", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "email" character varying, "full_name" character varying, "phone" character varying NOT NULL, "password" character varying, "is_banned" boolean NOT NULL DEFAULT false, "profile_image_key" character varying, "last_login_at" TIMESTAMP WITH TIME ZONE, "last_logout_at" TIMESTAMP WITH TIME ZONE, "google_id" character varying, "apple_id" character varying, "login_provider" character varying, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_073999dfec9d14522f0cf58cd6" ON "users" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0adc0a8834ea0f252e96d154de" ON "users" ("full_name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_828a06f7ee7c54015682a8ecf7" ON "users" ("is_banned") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_appleId_active" ON "users" ("apple_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_googleId_active" ON "users" ("google_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_phone_active" ON "users" ("phone") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "settings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "key" character varying NOT NULL, "value" jsonb NOT NULL DEFAULT '{}', "description" text, CONSTRAINT "PK_0669fe20e252eb692bf4d344975" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ebebfa479dbc6c92bfc07cbd54" ON "settings" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_settings_key_active" ON "settings" ("key") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" SERIAL NOT NULL, "admin_id" uuid, "action" character varying NOT NULL, "description" text NOT NULL, "entity_name" character varying, "entity_id" character varying, "old_value" jsonb, "new_value" jsonb, "ip_address" character varying, "user_agent" character varying, "device" character varying, "browser" character varying, "os" character varying, "location" character varying, "status" character varying NOT NULL DEFAULT 'SUCCESS', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9ac4b82f0b0f68801024154d19" ON "audit_logs" ("entity_name", "entity_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3dba8d7dfe897cf974a8d1c297" ON "audit_logs" ("admin_id", "action", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "activity_logs" ("id" SERIAL NOT NULL, "user_id" uuid NOT NULL, "action" character varying NOT NULL, "description" text NOT NULL, "resource_type" character varying, "resource_id" character varying, "ip_address" character varying, "user_agent" character varying, "device" character varying, "browser" character varying, "os" character varying, "location" character varying, "status" character varying NOT NULL DEFAULT 'SUCCESS', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f25287b6140c5ba18d38776a796" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_366035c36727bb87deda99e8a6" ON "activity_logs" ("user_id", "action", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "modules" ADD CONSTRAINT "FK_a1bd9c21d7179d0b411dbaf9a55" FOREIGN KEY ("parent_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "FK_738f46bb9ac6ea356f1915835d0" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ADD CONSTRAINT "FK_5733c73cd81c566a90cc4802f96" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_ecd766716e82c2e0f1cf6cb6281" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "otp_records" ADD CONSTRAINT "FK_2f19c4c5f1e1a61aea6f5877586" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "otp_records" ADD CONSTRAINT "FK_7ad64c886530ff1b4bf0357a4ff" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_b29de603374cbfa7d776d88e5b5" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "activity_logs" ADD CONSTRAINT "FK_d54f841fa5478e4734590d44036" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_logs" DROP CONSTRAINT "FK_d54f841fa5478e4734590d44036"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_b29de603374cbfa7d776d88e5b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "otp_records" DROP CONSTRAINT "FK_7ad64c886530ff1b4bf0357a4ff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "otp_records" DROP CONSTRAINT "FK_2f19c4c5f1e1a61aea6f5877586"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_ecd766716e82c2e0f1cf6cb6281"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" DROP CONSTRAINT "FK_5733c73cd81c566a90cc4802f96"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" DROP CONSTRAINT "FK_738f46bb9ac6ea356f1915835d0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "modules" DROP CONSTRAINT "FK_a1bd9c21d7179d0b411dbaf9a55"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_366035c36727bb87deda99e8a6"`,
    );
    await queryRunner.query(`DROP TABLE "activity_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3dba8d7dfe897cf974a8d1c297"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9ac4b82f0b0f68801024154d19"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_settings_key_active"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ebebfa479dbc6c92bfc07cbd54"`,
    );
    await queryRunner.query(`DROP TABLE "settings"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_phone_active"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_googleId_active"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_appleId_active"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_828a06f7ee7c54015682a8ecf7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0adc0a8834ea0f252e96d154de"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_073999dfec9d14522f0cf58cd6"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_466fbbc290957f89c78e9d18b2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e383daa23a6877fa31353a9fe9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d72060b2501b9ed4cd62e7ebc6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7ad64c886530ff1b4bf0357a4f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2f19c4c5f1e1a61aea6f587758"`,
    );
    await queryRunner.query(`DROP TABLE "otp_records"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_14187aa4d2d58318c82c62c7ea"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9de861562a968206b3dac37bb9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ba3bd69c8ad1e799c0256e9e50"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ecd766716e82c2e0f1cf6cb628"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ddc983c5f7bcf132fd8732c3f"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_admins_email_active"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_07972025d2d8847474f45962cc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5733c73cd81c566a90cc4802f9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4474a623b12e66592815dc8bba"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c6ef87dba2fe6e060a957fca9b"`,
    );
    await queryRunner.query(`DROP TABLE "admins"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_roles_name_active"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7fd0c79dc4e6083ddea850ac38"`,
    );
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_25d24010f53bb80b78e412c965"`,
    );
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_permissions_module_action_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_738f46bb9ac6ea356f1915835d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1ea42cae477fc1dc619a5cd280"`,
    );
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_modules_code_active"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d233555396cba99afaab4868b6"`,
    );
    await queryRunner.query(`DROP TABLE "modules"`);
  }
}
