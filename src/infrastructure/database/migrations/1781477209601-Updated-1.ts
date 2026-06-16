import { MigrationInterface, QueryRunner } from 'typeorm';

export class Updated11781477209601 implements MigrationInterface {
  name = 'Updated11781477209601';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3f500d94974610083b9c7a5d22"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "isContentCreator"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "UQ_c25bc63d248ca90e8dcc1d92d06"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN "tokenHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD "tokenHash" text NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN "tokenHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD "tokenHash" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "UQ_c25bc63d248ca90e8dcc1d92d06" UNIQUE ("tokenHash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isContentCreator" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f500d94974610083b9c7a5d22" ON "users" ("isContentCreator") `,
    );
  }
}
