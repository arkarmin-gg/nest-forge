import { NestFactory } from '@nestjs/core';
import { SeederModule } from './seeder.module';
import { AdminSeeder } from 'src/modules/admin/seeders/admin.seeder';
import { RoleSeeder } from 'src/modules/role/seeders/role.seeder';
import { SettingSeeder } from 'src/modules/setting/seeders/setting.seeder';
import { UserSeeder } from 'src/modules/user/seeders/user.seeder';

async function runSeeders() {
  console.log('🌱 Starting database seeding...');

  const app = await NestFactory.createApplicationContext(SeederModule);

  try {
    const roleSeeder = app.get(RoleSeeder);
    const adminSeeder = app.get(AdminSeeder);
    const userSeeder = app.get(UserSeeder);
    const settingSeeder = app.get(SettingSeeder);

    console.log('📝 Seeding role and permission data...');
    await roleSeeder.seed();
    console.log('✅ Role and permission seeding completed');

    console.log('👤 Seeding admin data...');
    await adminSeeder.seed();
    console.log('✅ Admin seeding completed');

    console.log('📱 Seeding user data...');
    await userSeeder.seed();
    console.log('✅ User seeding completed');

    console.log('⚙️ Seeding application settings...');
    await settingSeeder.seed();
    console.log('✅ Settings seeding completed');

    console.log('🎉 All seeders completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Run the seeder
runSeeders().catch((error) => {
  console.error('❌ Fatal error during seeding:', error);
  process.exit(1);
});
