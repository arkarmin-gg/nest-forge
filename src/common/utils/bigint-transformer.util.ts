/** @lintignore Public TypeORM transformer exported from the common utils barrel. */
export const bigintTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseInt(value, 10),
};
