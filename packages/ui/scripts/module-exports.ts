/**
 * Read the export names of built modules with the TypeScript checker.
 *
 * The checker follows `export * from` and `export { a as b }` for both
 * declaration files and compiled JavaScript, so the two sides of the comparison
 * use one resolver and cannot disagree about re-exports. Type-only declarations
 * (interfaces, type aliases) are excluded from the declared side: they have no
 * runtime presence, so their absence from the compiled module is correct.
 */
import ts from 'typescript'

export type ModuleExports = {
  /** Export names of a `.d.ts` that exist at runtime (values, classes, enums, functions). */
  declared: Map<string, string[]>
  /** Export names of a compiled `.js` module. */
  runtime: Map<string, string[]>
}

function exportsOf(compiled: ts.Program, file: string): string[] {
  const checker = compiled.getTypeChecker()
  const source = compiled.getSourceFile(file)
  if (!source) throw new Error(`TypeScript could not load ${file}`)
  const moduleSymbol = checker.getSymbolAtLocation(source)
  // A file with no import or export has no module symbol: it exports nothing.
  if (!moduleSymbol) return []
  return checker.getExportsOfModule(moduleSymbol).flatMap((symbol) => {
    const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    // `getAliasedSymbol` yields the `unknown` symbol for an unresolvable target; keep the
    // name so a broken re-export surfaces instead of vanishing.
    const isType =
      !(resolved.flags & ts.SymbolFlags.Value) && !(resolved.flags & ts.SymbolFlags.ValueModule)
    const unresolved = !resolved.declarations?.length
    return isType && !unresolved ? [] : [symbol.name]
  })
}

function program(rootNames: string[]): ts.Program {
  return ts.createProgram({
    rootNames,
    options: {
      allowJs: true,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ESNext,
      types: [],
      // Declarations reference sibling modules by relative path only; nothing here
      // needs the consumer's conditions.
      customConditions: [],
    },
  })
}

/**
 * Value exports of each declaration file, and exports of each compiled module.
 *
 * `declarationFiles` and `runtimeFiles` are absolute paths.
 */
export function readModuleExports(
  declarationFiles: readonly string[],
  runtimeFiles: readonly string[]
): ModuleExports {
  const declaredProgram = program([...declarationFiles])
  const runtimeProgram = program([...runtimeFiles])
  return {
    declared: new Map(
      declarationFiles.map((file) => [file, exportsOf(declaredProgram, file).toSorted()])
    ),
    runtime: new Map(
      runtimeFiles.map((file) => [file, exportsOf(runtimeProgram, file).toSorted()])
    ),
  }
}
