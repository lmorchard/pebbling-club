export const isEqual = (a: any, b: any) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((val, index) => val === b[index]);
  }
  return a === b;
};
