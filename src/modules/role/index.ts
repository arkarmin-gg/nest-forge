export { RoleModule } from './role.module';
export { Role } from './entities/role.entity';
/** @lintignore Public decorator documented in ARCHITECTURE.md; used by downstream controllers when role checks are needed. */
export { RequireRoles } from './decorators/roles.decorator';
/** @lintignore Public guard documented in ARCHITECTURE.md; opt-in with @UseGuards when role checks are needed. */
export { RolesGuard } from './guards/roles.guard';
