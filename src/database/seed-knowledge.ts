import type { DatabaseSync, StatementSync } from 'node:sqlite'
import { KnowledgeBaseSchema } from '../data/contracts.ts'

export interface KnowledgeSeedResult {
  works: number
  known_characters: number
  relationships: number
  iconic_moments: number
}

export const seedKnowledgeBase = (
  database: DatabaseSync,
  input: unknown
): KnowledgeSeedResult => {
  const knowledge = KnowledgeBaseSchema.parse(input)
  const upsertWork = database.prepare(`
    INSERT INTO works (
      id, title, original_title, media_type, release_year, rights_status,
      risk_level, payload_json, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      original_title = excluded.original_title,
      media_type = excluded.media_type,
      release_year = excluded.release_year,
      rights_status = excluded.rights_status,
      risk_level = excluded.risk_level,
      payload_json = excluded.payload_json,
      last_verified_at = excluded.last_verified_at
  `) as StatementSync
  const upsertCharacter = database.prepare(`
    INSERT INTO known_characters (
      id, work_id, name, rights_status, risk_level, payload_json, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      work_id = excluded.work_id,
      name = excluded.name,
      rights_status = excluded.rights_status,
      risk_level = excluded.risk_level,
      payload_json = excluded.payload_json,
      last_verified_at = excluded.last_verified_at
  `) as StatementSync
  const upsertRelationship = database.prepare(`
    INSERT INTO character_relationships (
      id, work_id, from_character_id, to_character_id, relation,
      payload_json, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      work_id = excluded.work_id,
      from_character_id = excluded.from_character_id,
      to_character_id = excluded.to_character_id,
      relation = excluded.relation,
      payload_json = excluded.payload_json,
      last_verified_at = excluded.last_verified_at
  `) as StatementSync
  const upsertMoment = database.prepare(`
    INSERT INTO iconic_moments (
      id, work_id, name, rights_status, risk_level, payload_json, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      work_id = excluded.work_id,
      name = excluded.name,
      rights_status = excluded.rights_status,
      risk_level = excluded.risk_level,
      payload_json = excluded.payload_json,
      last_verified_at = excluded.last_verified_at
  `) as StatementSync

  database.exec('BEGIN IMMEDIATE')
  try {
    for (const work of knowledge.works) {
      upsertWork.run(
        work.id, work.title, work.original_title, work.media_type, work.release_year,
        work.rights_status, work.risk_level, JSON.stringify(work), work.last_verified_at
      )
    }
    for (const character of knowledge.known_characters) {
      upsertCharacter.run(
        character.id, character.work_id, character.name, character.rights_status,
        character.risk_level, JSON.stringify(character), character.last_verified_at
      )
    }
    for (const relationship of knowledge.relationships) {
      upsertRelationship.run(
        relationship.id, relationship.work_id, relationship.from_character_id,
        relationship.to_character_id, relationship.relation,
        JSON.stringify(relationship), relationship.last_verified_at
      )
    }
    for (const moment of knowledge.iconic_moments) {
      upsertMoment.run(
        moment.id, moment.work_id, moment.name, moment.rights_status,
        moment.risk_level, JSON.stringify(moment), moment.last_verified_at
      )
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  return {
    works: knowledge.works.length,
    known_characters: knowledge.known_characters.length,
    relationships: knowledge.relationships.length,
    iconic_moments: knowledge.iconic_moments.length
  }
}
