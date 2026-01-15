export const sortedQuery = (query: Record<string, any>) => {
  return Object.keys(query)
    .sort()
    .reduce((result: Record<string, any>, key) => {
      if (query[key] !== undefined && query[key] !== '') {
        result[key] = query[key];
      }
      return result;
    }, {});
};