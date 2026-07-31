import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ZodType } from 'zod'

export class JsonDocumentStore<T> {
  private readonly filePath: string
  private readonly schema: ZodType<T>
  private readonly createEmpty: () => T

  constructor(filePath: string, schema: ZodType<T>, createEmpty: () => T) {
    this.filePath = filePath
    this.schema = schema
    this.createEmpty = createEmpty
  }

  async read(): Promise<T> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      return this.schema.parse(JSON.parse(raw) as unknown)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.schema.parse(this.createEmpty())
      }
      throw error
    }
  }

  async write(document: T): Promise<void> {
    const validated = this.schema.parse(document)
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`

    try {
      await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      })
      await rename(temporaryPath, this.filePath)
    } catch (error) {
      await rm(temporaryPath, { force: true })
      throw error
    }
  }
}
