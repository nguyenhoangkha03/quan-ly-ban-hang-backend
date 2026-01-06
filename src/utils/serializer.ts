// Serialize BigInt values to strings for JSON compatibility
export function serializeBigInt<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return String(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => serializeBigInt(item)) as T;
  }

  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'bigint') {
          serialized[key] = value.toString();
        } else if (Array.isArray(value)) {
          serialized[key] = value.map((item) => serializeBigInt(item));
        } else if (typeof value === 'object' && value !== null) {
          serialized[key] = serializeBigInt(value);
        } else {
          serialized[key] = value;
        }
      }
    }
    return serialized as T;
  }

  return obj;
}
