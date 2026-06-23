export class CatalogDatabaseConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CatalogDatabaseConfigError'
  }
}
