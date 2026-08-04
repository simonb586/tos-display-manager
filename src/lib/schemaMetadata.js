export function groupSchemaFieldNames(rows = []) {
  const grouped = {};
  for (const row of rows) {
    (grouped[row.table_name] ??= []).push(row.column_name);
  }
  return grouped;
}

export function normalizeSchemaMetadata(row = {}) {
  return {
    tableName: row.table_name || '',
    columnName: row.column_name || '',
    dataType: row.data_type || '',
    udtName: row.udt_name || '',
    ordinalPosition: row.ordinal_position ?? null,
    nullable: row.is_nullable ?? null,
    defaultValue: row.column_default ?? null,
    maximumLength: row.character_maximum_length ?? null,
    numericPrecision: row.numeric_precision ?? null,
    numericScale: row.numeric_scale ?? null,
    primaryKey: row.is_primary_key ?? null,
    unique: row.is_unique ?? null,
    foreignKey: row.is_foreign_key ?? null,
    foreignTable: row.foreign_table_name ?? null,
    foreignColumn: row.foreign_column_name ?? null,
    generated: row.is_generated ?? null,
    generationExpression: row.generation_expression ?? null,
    identity: row.is_identity ?? null
  };
}

export function groupSchemaMetadata(rows = []) {
  const grouped = {};
  for (const row of rows) {
    const metadata = normalizeSchemaMetadata(row);
    (grouped[metadata.tableName] ??= []).push(metadata);
  }
  return grouped;
}
