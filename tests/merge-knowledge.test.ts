import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { KnowledgeBaseSchema } from '../src/data/contracts.ts'
import type { KnowledgeBase } from '../src/data/contracts.ts'
import { KnowledgeBatchSchema, KnowledgeMergeError, mergeKnowledgeBatches } from '../src/knowledge/merge-knowledge.ts'

// 从 KnowledgeBase 派生实体类型，用于测试辅助函数返回值断言
type Work = KnowledgeBase['works'][number]
type KnownCharacter = KnowledgeBase['known_characters'][number]
type CharacterRelationship = KnowledgeBase['relationships'][number]
type IconicMoment = KnowledgeBase['iconic_moments'][number]

const verifiedAt = '2026-07-29T03:00:00.000Z'
const laterVerifiedAt = '2026-07-30T03:00:00.000Z'

// 构造合法的 Work 批次数据；运行时由 Schema 校验，类型断言保证编译期类型匹配
const createWork = (overrides: Record<string, unknown> = {}): Work =>
  ({
    id: 'work_test_alpha',
    title: '测试作品甲',
    original_title: 'Test Work Alpha',
    aliases: ['测试甲'],
    media_type: 'television',
    regions: ['中国大陆'],
    release_year: 2020,
    genres: ['剧情'],
    rights_status: 'reference_only',
    risk_level: 'medium',
    sources: [
      {
        url: 'https://example.com/work-alpha',
        source_name: 'Example',
        page_title: 'Work Alpha',
        published_at: null,
        collected_at: verifiedAt,
      },
    ],
    last_verified_at: verifiedAt,
    ...overrides,
  }) as Work

const createCharacter = (overrides: Record<string, unknown> = {}): KnownCharacter =>
  ({
    id: 'known_test_char_alpha',
    work_id: 'work_test_alpha',
    name: '测试角色甲',
    aliases: ['角色甲'],
    roles: ['核心人物'],
    character_types: ['成长型主角'],
    traits: ['勇敢'],
    dialogue_style: ['直接表达'],
    relationships: [],
    rights_status: 'reference_only',
    risk_level: 'medium',
    sources: [
      {
        url: 'https://example.com/char-alpha',
        source_name: 'Example',
        page_title: 'Char Alpha',
        published_at: null,
        collected_at: verifiedAt,
      },
    ],
    last_verified_at: verifiedAt,
    ...overrides,
  }) as KnownCharacter

const createRelationship = (overrides: Record<string, unknown> = {}): CharacterRelationship =>
  ({
    id: 'relation_test_alpha_beta',
    work_id: 'work_test_alpha',
    from_character_id: 'known_test_char_alpha',
    to_character_id: 'known_test_char_beta',
    relation: '同伴',
    description: '测试关系。',
    sources: [
      {
        url: 'https://example.com/relation',
        source_name: 'Example',
        page_title: 'Relation',
        published_at: null,
        collected_at: verifiedAt,
      },
    ],
    last_verified_at: verifiedAt,
    ...overrides,
  }) as CharacterRelationship

const createMoment = (overrides: Record<string, unknown> = {}): IconicMoment =>
  ({
    id: 'moment_test_alpha',
    work_id: 'work_test_alpha',
    name: '测试名场面',
    participant_ids: ['known_test_char_alpha'],
    setting: '测试场景',
    conflict_type: '测试冲突',
    emotional_arc: ['紧张', '爆发', '平复'],
    visual_actions: ['对峙'],
    reusable_beats: ['铺垫', '升级', '收尾'],
    dialogue_patterns: ['短句推进', '沉默回应'],
    abstraction: '测试抽象结构。',
    rights_status: 'reference_only',
    risk_level: 'medium',
    sources: [
      {
        url: 'https://example.com/moment',
        source_name: 'Example',
        page_title: 'Moment',
        published_at: null,
        collected_at: verifiedAt,
      },
    ],
    last_verified_at: verifiedAt,
    ...overrides,
  }) as IconicMoment

const withTemporaryDirectory = async (callback: (directory: string) => Promise<void>) => {
  const directory = await mkdtemp(join(tmpdir(), 'linggan-a3-'))
  try {
    await callback(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('batch schema accepts partial knowledge with only works', () => {
  const batch = { schema_version: 1, works: [createWork()] }
  assert.equal(KnowledgeBatchSchema.safeParse(batch).success, true)
})

test('batch schema accepts empty collections', () => {
  const batch = { schema_version: 1, works: [], known_characters: [] }
  assert.equal(KnowledgeBatchSchema.safeParse(batch).success, true)
})

test('batch schema rejects unknown top-level keys', () => {
  const batch = { schema_version: 1, works: [], unknown_field: 1 }
  assert.equal(KnowledgeBatchSchema.safeParse(batch).success, false)
})

// 验收条件 1：分批填充——先 works 批次，再 characters 批次，合并后外键有效
test('merges works and characters from separate batches into valid knowledge base', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)
    await writeFile(
      join(inbox, '01-works.json'),
      JSON.stringify({
        schema_version: 1,
        works: [createWork()],
      }),
    )
    await writeFile(
      join(inbox, '02-characters.json'),
      JSON.stringify({
        schema_version: 1,
        known_characters: [
          createCharacter(),
          createCharacter({
            id: 'known_test_char_beta',
            name: '测试角色乙',
            aliases: [],
          }),
        ],
      }),
    )

    const report = await mergeKnowledgeBatches({ inboxDirectory: inbox, outputPath })
    assert.equal(report.files_processed, 2)
    assert.equal(report.new_ids, 3)
    assert.equal(report.merged_ids, 0)
    assert.equal(report.works, 1)
    assert.equal(report.known_characters, 2)

    const doc = KnowledgeBaseSchema.parse(JSON.parse(await readFile(outputPath, 'utf8')))
    assert.equal(doc.works[0].id, 'work_test_alpha')
    assert.equal(doc.known_characters.length, 2)
  })
})

// 验收条件 2：跨批次幂等——同批次重复运行结果不变
test('repeating merge with same batches is idempotent', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)
    const batch = {
      schema_version: 1,
      works: [createWork()],
      known_characters: [createCharacter()],
    }
    await writeFile(join(inbox, 'batch.json'), JSON.stringify(batch))

    const firstReport = await mergeKnowledgeBatches({ inboxDirectory: inbox, outputPath })
    const first = await readFile(outputPath, 'utf8')
    // 第二次运行：baseDocument 已包含全部实体，inbox 同批次再次合并
    const secondReport = await mergeKnowledgeBatches({ inboxDirectory: inbox, outputPath })
    const second = await readFile(outputPath, 'utf8')

    assert.equal(second, first)
    // 第一次：2 个新实体
    assert.equal(firstReport.new_ids, 2)
    assert.equal(firstReport.merged_ids, 0)
    // 第二次：2 个实体已存在，合并而非新增
    assert.equal(secondReport.new_ids, 0)
    assert.equal(secondReport.merged_ids, 2)
    assert.equal(secondReport.works, 1)
    assert.equal(secondReport.known_characters, 1)
  })
})

// 验收条件 3：来源合并——同 ID 实体跨批次合并 sources、aliases、traits
test('cross-batch same id merges sources aliases and traits', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)
    // 先放入 work，确保 known_characters 的 work_id 外键有效
    await writeFile(
      join(inbox, '00-work.json'),
      JSON.stringify({
        schema_version: 1,
        works: [createWork()],
      }),
    )
    await writeFile(
      join(inbox, '01-char.json'),
      JSON.stringify({
        schema_version: 1,
        known_characters: [
          createCharacter({
            aliases: ['角色甲', '初始别名'],
            traits: ['勇敢'],
            sources: [
              {
                url: 'https://example.com/source-1',
                source_name: 'Source One',
                page_title: 'First',
                published_at: null,
                collected_at: verifiedAt,
              },
            ],
          }),
        ],
      }),
    )
    await writeFile(
      join(inbox, '02-char.json'),
      JSON.stringify({
        schema_version: 1,
        known_characters: [
          createCharacter({
            aliases: ['角色甲', '补充别名'],
            traits: ['谨慎', '勇敢'],
            sources: [
              {
                url: 'https://example.com/source-2',
                source_name: 'Source Two',
                page_title: 'Second',
                published_at: null,
                collected_at: laterVerifiedAt,
              },
            ],
            last_verified_at: laterVerifiedAt,
          }),
        ],
      }),
    )

    const report = await mergeKnowledgeBatches({ inboxDirectory: inbox, outputPath })
    // work 新增 1，character 第一次新增 1、第二次合并 1
    assert.equal(report.merged_ids, 1)
    assert.equal(report.new_ids, 2)

    const doc = KnowledgeBaseSchema.parse(JSON.parse(await readFile(outputPath, 'utf8')))
    const char = doc.known_characters[0]
    // 别名合并去重
    assert.deepEqual(char.aliases, ['角色甲', '初始别名', '补充别名'])
    // traits 合并去重，保持首次出现顺序
    assert.deepEqual(char.traits, ['勇敢', '谨慎'])
    // 来源按 URL 去重合并
    assert.equal(char.sources.length, 2)
    assert.equal(char.sources[0].url, 'https://example.com/source-1')
    assert.equal(char.sources[1].url, 'https://example.com/source-2')
    // last_verified_at 取较新者
    assert.equal(char.last_verified_at, laterVerifiedAt)
  })
})

// 验收条件 4：风险等级取更保守值
test('risk level takes the more conservative value on merge', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)
    await writeFile(
      join(inbox, '01-work.json'),
      JSON.stringify({
        schema_version: 1,
        works: [createWork({ risk_level: 'low' })],
      }),
    )
    await writeFile(
      join(inbox, '02-work.json'),
      JSON.stringify({
        schema_version: 1,
        works: [createWork({ risk_level: 'high' })],
      }),
    )

    await mergeKnowledgeBatches({ inboxDirectory: inbox, outputPath })
    const doc = KnowledgeBaseSchema.parse(JSON.parse(await readFile(outputPath, 'utf8')))
    // low + high → high（更保守）
    assert.equal(doc.works[0].risk_level, 'high')
  })
})

// 验收条件 5：坏批次跳过，有效批次仍合并
test('migration skips a bad batch while importing valid batches', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)
    await writeFile(
      join(inbox, 'valid.json'),
      JSON.stringify({
        schema_version: 1,
        works: [createWork()],
      }),
    )
    await writeFile(join(inbox, 'invalid.json'), '{broken json')

    const report = await mergeKnowledgeBatches({ inboxDirectory: inbox, outputPath })
    assert.equal(report.files_discovered, 2)
    assert.equal(report.files_processed, 1)
    assert.equal(report.files_failed, 1)
    assert.equal(report.works, 1)
    assert.match(report.failures[0].file, /invalid\.json$/)
  })
})

// 验收条件 6：别名归一——Schema 在解析时拒绝同实体内的重复别名
test('batch schema rejects duplicate aliases within one entity', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)
    // 同一 work 的 aliases 包含重复值，UniqueStringListSchema 会拒绝
    await writeFile(
      join(inbox, 'batch.json'),
      JSON.stringify({
        schema_version: 1,
        works: [createWork({ aliases: ['测试甲', '测试甲'] })],
      }),
    )

    const report = await mergeKnowledgeBatches({ inboxDirectory: inbox, outputPath })
    assert.equal(report.files_failed, 1)
    assert.equal(report.files_processed, 0)
    assert.equal(report.works, 0)
    // 坏批次被跳过，合并结果为空库仍会原子写入（空库合法）
    const doc = KnowledgeBaseSchema.parse(JSON.parse(await readFile(outputPath, 'utf8')))
    assert.equal(doc.works.length, 0)
  })
})

// 验收条件 7：别名冲突——不同实体同别名导致合并失败，不写入
test('alias conflict between different entities fails merge without writing', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)
    await writeFile(
      join(inbox, 'conflict.json'),
      JSON.stringify({
        schema_version: 1,
        works: [
          createWork({ id: 'work_a', title: '作品甲', aliases: ['冲突别名'] }),
          createWork({
            id: 'work_b',
            title: '作品乙',
            aliases: [],
            sources: [
              {
                url: 'https://example.com/work-b',
                source_name: 'Example',
                page_title: 'Work B',
                published_at: null,
                collected_at: verifiedAt,
              },
            ],
          }),
        ],
      }),
    )

    // 作品乙的 aliases 包含「冲突别名」会与作品甲的别名冲突
    const conflictBatch = {
      schema_version: 1,
      works: [
        createWork({ id: 'work_a', title: '作品甲', aliases: ['冲突别名'] }),
        createWork({ id: 'work_b', title: '作品乙', aliases: ['冲突别名'] }),
      ],
    }
    // 先确认批次自身通过 batch schema（batch schema 不做跨实体别名校验）
    assert.equal(KnowledgeBatchSchema.safeParse(conflictBatch).success, true)

    // 重写文件为冲突批次
    await writeFile(join(inbox, 'conflict.json'), JSON.stringify(conflictBatch))

    await assert.rejects(mergeKnowledgeBatches({ inboxDirectory: inbox, outputPath }), KnowledgeMergeError)

    // 失败时不应写入输出文件
    await assert.rejects(readFile(outputPath, 'utf8'), /ENOENT/)
  })
})

// 验收条件 8：合并结果通过 KnowledgeBaseSchema（外键、全局唯一性）
test('merged document passes full knowledge base schema with relationships and moments', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)
    await writeFile(
      join(inbox, 'full.json'),
      JSON.stringify({
        schema_version: 1,
        works: [createWork()],
        known_characters: [
          createCharacter(),
          createCharacter({ id: 'known_test_char_beta', name: '测试角色乙', aliases: [] }),
        ],
        relationships: [createRelationship()],
        iconic_moments: [createMoment()],
      }),
    )

    const report = await mergeKnowledgeBatches({ inboxDirectory: inbox, outputPath })
    assert.equal(report.works, 1)
    assert.equal(report.known_characters, 2)
    assert.equal(report.relationships, 1)
    assert.equal(report.iconic_moments, 2 ** 0) // 1

    // 读取后再次校验，确认外键、全局唯一性均满足
    const raw = JSON.parse(await readFile(outputPath, 'utf8'))
    const doc = KnowledgeBaseSchema.parse(raw)
    assert.equal(doc.relationships[0].from_character_id, 'known_test_char_alpha')
    assert.equal(doc.relationships[0].to_character_id, 'known_test_char_beta')
  })
})

// 验收条件 9：原子写入——校验失败时旧文件不变
test('invalid merge preserves the previous knowledge base file', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)

    // 先写入一个合法的基础文档
    const base: KnowledgeBase = {
      schema_version: 1,
      works: [createWork()],
      known_characters: [createCharacter()],
      relationships: [],
      iconic_moments: [],
    }
    await writeFile(outputPath, `${JSON.stringify(base, null, 2)}\n`)
    const original = await readFile(outputPath, 'utf8')

    // 放入一个引用不存在 work_id 的批次，合并后会因外键校验失败
    await writeFile(
      join(inbox, 'bad.json'),
      JSON.stringify({
        schema_version: 1,
        known_characters: [createCharacter({ work_id: 'work_nonexistent' })],
      }),
    )

    await assert.rejects(mergeKnowledgeBatches({ inboxDirectory: inbox, outputPath }))
    // 旧文件内容不变
    assert.equal(await readFile(outputPath, 'utf8'), original)
  })
})

// 验收条件 10：空 inbox 时保留基础文档不变
test('empty inbox preserves base document content', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)

    const base: KnowledgeBase = {
      schema_version: 1,
      works: [createWork()],
      known_characters: [createCharacter()],
      relationships: [],
      iconic_moments: [],
    }

    const report = await mergeKnowledgeBatches({
      inboxDirectory: inbox,
      outputPath,
      baseDocument: base,
    })
    assert.equal(report.files_discovered, 0)
    assert.equal(report.works, 1)
    assert.equal(report.known_characters, 1)

    const doc = KnowledgeBaseSchema.parse(JSON.parse(await readFile(outputPath, 'utf8')))
    assert.equal(doc.works[0].id, 'work_test_alpha')
  })
})

// 验收条件 11：baseDocument 与 inbox 批次合并，已存在实体按 ID 合并而非重复
test('base document entities merge with inbox by id without duplication', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inbox = join(directory, 'inbox')
    const outputPath = join(directory, 'knowledge-base.json')
    await mkdir(inbox)

    const base: KnowledgeBase = {
      schema_version: 1,
      works: [createWork({ aliases: ['基础别名'] })],
      known_characters: [createCharacter()],
      relationships: [],
      iconic_moments: [],
    }

    // inbox 中同 ID 作品补充别名和新来源
    await writeFile(
      join(inbox, 'update.json'),
      JSON.stringify({
        schema_version: 1,
        works: [createWork({ aliases: ['补充别名'] })],
      }),
    )

    const report = await mergeKnowledgeBatches({
      inboxDirectory: inbox,
      outputPath,
      baseDocument: base,
    })
    assert.equal(report.merged_ids, 1)
    assert.equal(report.new_ids, 0)
    assert.equal(report.works, 1)

    const doc = KnowledgeBaseSchema.parse(JSON.parse(await readFile(outputPath, 'utf8')))
    assert.deepEqual(doc.works[0].aliases, ['基础别名', '补充别名'])
  })
})
