export const camelCase = (str: string): string => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

export const capitalize = (str: string): string  => `${str.charAt(0).toUpperCase()}${str.slice(1)}`;
