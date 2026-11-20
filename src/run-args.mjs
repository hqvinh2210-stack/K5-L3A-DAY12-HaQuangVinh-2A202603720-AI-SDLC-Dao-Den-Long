export function parseOptions(args, names) {
  const allowed=new Set(names);
  const values=Object.create(null);
  for (let i=0;i<args.length;i+=2) {
    const name=args[i].slice(2);
    if (!args[i].startsWith('--') || !allowed.has(name) || Object.hasOwn(values,name) ||
        !args[i+1] || args[i+1].startsWith('--')) throw new Error('Invalid option: '+args[i]);
    values[name]=args[i+1];
  }
  return values;
}

export function readInteger(value, key, min, max=Number.MAX_SAFE_INTEGER) {
  const number=Number(value);
  if (!/^-?\d+$/.test(value??'') || !Number.isSafeInteger(number) || number<min || number>max) {
    throw new Error('Invalid --'+key);
  }
  return number;
}
