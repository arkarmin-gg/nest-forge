export const bigintTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseInt(value, 10),
};
