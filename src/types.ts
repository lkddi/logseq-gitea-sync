/**
 * Local type definitions mirrored from Logseq's SDK declaration files
 * (node_modules/@logseq/libs/dist/LSPlugin.d.ts). The published package does
 * not expose these types via package.json "types", so we keep them here.
 */

export interface IGitResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface SettingSchemaDesc {
  key: string
  type: 'string' | 'number' | 'boolean' | 'enum' | 'object' | 'heading'
  default: string | number | boolean | Array<any> | object | null
  title: string
  description: string
  inputAs?: 'color' | 'date' | 'datetime-local' | 'range' | 'textarea'
  enumChoices?: Array<string>
  enumPicker?: 'select' | 'radio' | 'checkbox'
}
