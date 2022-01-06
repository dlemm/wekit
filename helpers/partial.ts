import { readFile } from 'fs/promises';
import path from 'path';
import micromatch from 'micromatch';

type Partial = { type: string; entry: string };
type PartialDeps = { [x: string]: Partial[] };

/**
 * Compute the hard-coded dependencies used in partial files
 *
 * @param files List of available partial files
 * @returns Map with dependencies for each partial
 */
export async function getDependencies(files: string[]): Promise<PartialDeps> {
  const promises = files.map<Promise<[string, string[]]>>(async (file) => {
    const type = path.basename(path.dirname(file));
    const name = path.basename(file, '.html');

    const key = `${type}/${name}`;
    const content = await readFile(file, 'utf8');
    const matches = content.matchAll(/{{.*\s+partial(?:Cached)?\s+"([^\"]+)"/gim);
    const dependencies = Array.from(matches).map((match) => `*${match[1]}*`) as string[];

    return [key, dependencies];
  });

  const dependencyEntries = await Promise.all(promises);
  const dependencyMap = Object.fromEntries(dependencyEntries);
  const dependencyKeys = Object.keys(dependencyMap);

  const getKey = (identifier: string): string =>
    dependencyKeys.find((key) => micromatch.contains(identifier, [key])) || '';

  const getPartialDependencies = (identifier: string): string[] => {
    const componentKey = getKey(identifier);
    const { [componentKey]: result = [] } = dependencyMap;
    return result;
  };

  const getInternalDeps = (key: string, deps: string[] = []): string[] => {
    const dependencies = getPartialDependencies(key);
    return [
      ...deps,
      ...dependencies
        // prevent recursion
        .filter((dep) => !deps.includes(dep))
        .flatMap((dep) => {
          return getInternalDeps(dep, [...deps, getKey(key)]);
        }),
    ];
  };

  return Object.fromEntries(
    dependencyEntries.map(([key, dependencies]) => {
      return [
        key,
        [...new Set(dependencies.flatMap((a) => getInternalDeps(a)))].map((dep) => {
          const [type, entry] = dep.split('/');
          return { type, entry };
        }),
      ];
    })
  );
}
