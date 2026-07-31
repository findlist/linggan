// 跨作品混搭工作台：渲染表单 / 中栏预览 / 右栏完整制作包三栏布局。
// 包含生成、复制、收藏、导出、C3 重复检测和重新加载等行为。
// 跨 section 调用：
//   - 收藏后通过 ctx.renderSaved() 通知 SavedList 刷新；
//   - ctx.loadSavedRemix 由 SavedList 重新加载收藏时调用本模块返回的 loadSavedRemix；
//   - 详情视图 applyToRemix 通过 ctx.applyToRemix 注入。

import { icon } from '../ui/icons.js'
import { escapeHtml, downloadText, toast } from '../ui/dom.js'
import {
  knowledge,
  workById,
  characterById,
  remixStyles,
  personalityLabels,
  hookCategoryLabels,
  shotTypeLabels,
  cameraMovementLabels,
  transitionLabels,
} from '../data/knowledge.js'
import { getState, incrementGeneration, setCurrentResult, setDuration } from '../data/store.js'
import { buildRemixPlan } from '../generation/remix-engine.ts'
import { buildRemixFileName, buildRemixJson, buildRemixMarkdown } from '../generation/exporters.ts'
// C4：引入 C3 近似度检测，在前端把当前方案与已收藏方案对比，标记换皮创意
import { detectDuplicates } from '../generation/similarity.ts'
// D2：前端事件采集，记录方案曝光、复制、收藏和导出行为
import { track } from '../data/tracker.ts'
// D5：创作历史自动记录，每次用户主动生成都持久化到 localStorage 供回看
import { addHistory, getHistory } from '../data/history.ts'

// 渲染角色 A / B 下拉选项；selected 用于初始默认值（来自原 main.js）
const renderCharacterOptions = (selected) =>
  knowledge.known_characters
    .map((character) => {
      const work = workById.get(character.work_id)
      return `<option value="${character.id}" ${character.id === selected ? 'selected' : ''}>${escapeHtml(character.name)} · ${escapeHtml(work.title)}</option>`
    })
    .join('')

const renderMomentOptions = (selected) =>
  knowledge.iconic_moments
    .map((moment) => {
      const work = workById.get(moment.work_id)
      return `<option value="${moment.id}" ${moment.id === selected ? 'selected' : ''}>${escapeHtml(moment.name)} · ${escapeHtml(work.title)}</option>`
    })
    .join('')

// 渲染工作台 section 初始 HTML：三栏布局（表单 / 预览 / 完整制作包）
export const renderRemixWorkbench = () => `
  <section class="remix-section shell" id="remix">
    <div class="section-title"><div><span class="kicker">CROSSOVER LAB</span><h2>跨作品混搭实验室</h2><p>人物借用的是关系与性格，名场面借用的是冲突节奏；输出使用原创改写台词与非精确视觉方案。</p></div><button class="btn ghost randomize">${icon('shuffle', 17)} 随机换一组</button></div>
    <div class="remix-workspace">
      <form class="composer" id="remix-form">
        <div class="field"><label for="character-a"><span>01</span>主行动角色</label><select id="character-a">${renderCharacterOptions('known_han_li')}</select><small class="field-hint" id="hint-a"></small></div>
        <div class="operator">×</div>
        <div class="field"><label for="character-b"><span>02</span>关系碰撞角色</label><select id="character-b">${renderCharacterOptions('known_li_muwan')}</select><small class="field-hint" id="hint-b"></small></div>
        <div class="operator">×</div>
        <div class="field wide"><label for="moment"><span>03</span>名场面冲突结构</label><select id="moment">${renderMomentOptions('moment_mass_assault')}</select><small class="field-hint" id="hint-moment"></small></div>
        <div class="field style-field"><label for="style"><span>04</span>视频风格</label><select id="style">${remixStyles.map((style) => `<option value="${style.id}">${style.label}</option>`).join('')}</select></div>
        <div class="duration"><span>时长</span><button type="button" data-duration="15">15s</button><button type="button" class="active" data-duration="30">30s</button><button type="button" data-duration="60">60s</button></div>
        <button class="btn primary generate-remix" type="submit">${icon('sparkles', 18)} 生成混搭方案</button>
      </form>
      <article class="preview-card" id="preview-card" aria-live="polite"></article>
      <article class="result-card" id="result-card" aria-live="polite"></article>
    </div>
  </section>
`

// 更新表单字段下方的提示：把当前选中角色 / 名场面的类型与节拍展示出来
const updateHints = () => {
  const a = characterById.get(document.querySelector('#character-a').value)
  const b = characterById.get(document.querySelector('#character-b').value)
  const moment = knowledge.iconic_moments.find((item) => item.id === document.querySelector('#moment').value)
  document.querySelector('#hint-a').textContent = `${a.character_types.join(' · ')}｜${a.traits.join('、')}`
  document.querySelector('#hint-b').textContent = `${b.character_types.join(' · ')}｜${b.traits.join('、')}`
  document.querySelector('#hint-moment').textContent =
    `${moment.conflict_type}｜${moment.reusable_beats.slice(0, 2).join(' → ')}`
}

/**
 * C3 近似度检测：把当前生成的 plan 与已收藏 plans 合并后调用 detectDuplicates，
 * 找出当前 plan 是否与某个已收藏方案相似度超过阈值（默认 0.7），用于在前端标记换皮创意。
 * 返回 { isDuplicate, maxSimilarity, similarTitle } 供中栏预览展示警告。
 */
const checkDuplicateAgainstSaved = (plan) => {
  const { saved } = getState()
  // 排除与当前 plan 相同 id 的已收藏方案，避免收藏后自比导致相似度恒为 1
  const savedPlans = saved.filter((item) => item.plan && item.plan.id !== plan.id).map((item) => item.plan)
  if (savedPlans.length === 0) return { isDuplicate: false, maxSimilarity: 0, similarTitle: null }
  // 把当前 plan 放在数组末尾，检测时能拿到它与其他方案的相似度
  const detection = detectDuplicates([...savedPlans, plan])
  const currentFlag = detection.flags[detection.flags.length - 1]
  if (!currentFlag || !currentFlag.is_duplicate) {
    return { isDuplicate: false, maxSimilarity: currentFlag?.max_similarity ?? 0, similarTitle: null }
  }
  // 找出最相似的已收藏方案标题，用于提示用户
  const similarId = currentFlag.similar_to[0]
  const similarSaved = saved.find((item) => item.plan?.id === similarId)
  return {
    isDuplicate: true,
    maxSimilarity: currentFlag.max_similarity,
    similarTitle: similarSaved?.title ?? '已收藏方案',
  }
}

// 构建一次混搭方案：从表单读取输入并调用 buildRemixPlan
const buildRemix = () => {
  const a = characterById.get(document.querySelector('#character-a').value)
  const b = characterById.get(document.querySelector('#character-b').value)
  const moment = knowledge.iconic_moments.find((item) => item.id === document.querySelector('#moment').value)
  const style = remixStyles.find((item) => item.id === document.querySelector('#style').value)
  const { generation } = getState()
  // 种子加入 generation 计数器，使每次点击"生成"都能产生不同方案；同一 seed 字符串在引擎内确定性展开
  const seed = `${a.id}${b.id}${moment.id}${style.id}${generation}`
  const plan = buildRemixPlan({
    characterA: a,
    characterB: b,
    moment,
    workA: workById.get(a.work_id),
    workB: workById.get(b.work_id),
    momentWork: workById.get(moment.work_id),
    style,
    duration: getState().duration,
    seed,
  })
  // D5：返回 seed 供 addHistory 记录，支持后续可复现性
  return { plan, a, b, moment, style, seed }
}

// D5：把一次生成结果记录到创作历史，供用户回看和重新加载
const recordHistory = (result) => {
  const { plan, a, b, moment, style, seed } = result
  addHistory({
    plan,
    context: {
      characterAId: a.id,
      characterBId: b.id,
      momentId: moment.id,
      styleId: style.id,
    },
    seed,
  })
}

// 中栏预览：核心信息 + C3 重复标记 + 快速操作（复制 / 收藏）
const renderPreview = (result, ctx) => {
  const { plan } = result
  const preview = document.querySelector('#preview-card')
  // D2 埋点：方案渲染即曝光，记录 duration/hook/personality 供 D2 偏好画像聚合
  track('idea_impression', {
    ideaId: plan.id,
    payload: {
      source: 'remix_workbench',
      duration: plan.duration,
      hook_category: plan.hookCategory,
      personality_a: plan.personalityA,
      personality_b: plan.personalityB,
    },
  })
  // C3 近似度检测：与已收藏方案对比，标记换皮创意（排除自身 id 避免收藏后自比）
  const dup = checkDuplicateAgainstSaved(plan)
  const dupBanner = dup.isDuplicate
    ? `<div class="dup-warning">${icon('shield', 14)}<span>近似度 ${(dup.maxSimilarity * 100).toFixed(0)}% · 与《${escapeHtml(dup.similarTitle)}》高度相似，可能是换皮创意</span></div>`
    : dup.maxSimilarity > 0
      ? `<div class="dup-info">${icon('check', 14)}<span>与已收藏方案最大相似度 ${(dup.maxSimilarity * 100).toFixed(0)}%，未达换皮阈值</span></div>`
      : ''
  preview.innerHTML = `
    <div class="preview-top"><span class="preview-label">核心预览</span><span class="risk-badge">REFERENCE ONLY</span></div>
    <h3>${escapeHtml(plan.title)}</h3>
    <p class="concept">${escapeHtml(plan.concept)}</p>
    <div class="hook"><span>前三秒钩子</span><b>${escapeHtml(plan.hook)}</b></div>
    <div class="cover-copy"><span>封面文案</span><b>${escapeHtml(plan.copywriting.cover_copy)}</b></div>
    <div class="preview-tags"><span>${plan.duration}s</span><span>${hookCategoryLabels[plan.hookCategory]}钩子</span><span>${personalityLabels[plan.personalityA]} × ${personalityLabels[plan.personalityB]}</span><span>${plan.storyboard.length} 镜头</span></div>
    ${dupBanner}
    <div class="preview-actions"><button class="btn ghost copy-result">${icon('copy', 16)} 复制</button><button class="btn primary save-result">${icon('bookmark', 16)} 收藏</button></div>`
  preview.querySelector('.copy-result').addEventListener('click', async () => {
    await navigator.clipboard?.writeText(preview.innerText)
    // D2 埋点：复制方案视为可执行意图，记录钩子文本供后续转化漏斗分析
    track('prompt_copied', { ideaId: plan.id, payload: { hook: plan.hook, source: 'preview' } })
    toast('方案已复制')
  })
  preview.querySelector('.save-result').addEventListener('click', () => {
    const { saved } = getState()
    // 收藏保存完整方案和上下文，支持后续展开、重新加载和单条导出；按 plan.id 去重
    if (!saved.some((item) => item.id === plan.id)) {
      const nextSaved = [
        {
          id: plan.id,
          title: plan.title,
          hook: plan.hook,
          plan,
          context: {
            characterAId: result.a.id,
            characterBId: result.b.id,
            momentId: result.moment.id,
            styleId: result.style.id,
          },
          savedAt: new Date().toISOString(),
        },
        ...saved,
      ].slice(0, 8)
      ctx.setSaved(nextSaved)
      // D2 埋点：收藏视为长期价值信号，记录 duration 和风格供偏好画像
      track('idea_saved', {
        ideaId: plan.id,
        payload: { duration: plan.duration, style: result.style.id, source: 'workbench' },
      })
      // 收藏后重新渲染预览，更新 C3 标记状态；同步刷新 SavedList
      renderPreview(result, ctx)
      ctx.renderSaved()
      toast('已收藏到工作台')
    }
  })
}

// 右栏完整制作包：分镜表（含景别 / 运镜 / 转场）、对白、文案、提示词、版权边界、导出
const renderResult = (result, ctx) => {
  const { plan } = result
  renderPreview(result, ctx)
  const card = document.querySelector('#result-card')
  // C2 完整制作包：分镜表含景别 / 运镜 / 转场，结构化提示词，版权边界三字段
  card.innerHTML = `
    <div class="result-top"><span class="result-label">完整制作包 · ${plan.duration}s · ${hookCategoryLabels[plan.hookCategory]}钩子</span></div>
    <div class="storyboard-section">
      <h4>分镜表（${plan.storyboard.length} 镜头）</h4>
      <div class="beat-list storyboard-list">${plan.storyboard.map((shot) => `<div class="shot"><div class="shot-head"><span>#${String(shot.index).padStart(2, '0')} · ${shot.duration}s</span><small>${shotTypeLabels[shot.shot_type]} · ${cameraMovementLabels[shot.camera_movement]} · 转${transitionLabels[shot.transition]}</small></div><p class="shot-visual">${escapeHtml(shot.visual)}</p><small>动作：${escapeHtml(shot.action)} · 情绪：${escapeHtml(shot.emotion)}</small></div>`).join('')}</div>
    </div>
    <div class="dialogues"><div><span>${escapeHtml(result.a.name)} · 原创改写</span><p>${escapeHtml(plan.dialogueA)}</p></div><div><span>${escapeHtml(result.b.name)} · 原创改写</span><p>${escapeHtml(plan.dialogueB)}</p></div></div>
    <details class="copywriting-block"><summary>发布文案（3 标题 · 描述 · 标签 · 封面文案）</summary><div class="copy-titles"><span>标题候选</span><ul>${plan.copywriting.titles.map((title) => `<li>${escapeHtml(title)}</li>`).join('')}</ul></div><p class="copy-desc">${escapeHtml(plan.copywriting.description)}</p><div class="copy-tags">${plan.copywriting.hashtags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div><div class="cover-copy-row"><span>封面文案</span><b>${escapeHtml(plan.copywriting.cover_copy)}</b></div></details>
    <details class="prompt-block"><summary>结构化画面提示词</summary><div class="prompt-grid"><div><span>正向提示词</span><p>${escapeHtml(plan.production.prompts.positive)}</p></div><div><span>负面提示词</span><p>${escapeHtml(plan.production.prompts.negative)}</p></div><div class="prompt-meta"><span>比例</span><b>${escapeHtml(plan.production.prompts.aspect_ratio)}</b><span>风格强度</span><b>${(plan.production.prompts.style_strength * 100).toFixed(0)}%</b></div></div></details>
    <details class="copyright-block"><summary>版权边界声明</summary><div class="copyright-grid"><div><span>参考状态</span><p>${escapeHtml(plan.production.copyright_boundary.reference_status)}</p></div><div><span>商用限制</span><p>${escapeHtml(plan.production.copyright_boundary.commercial_use)}</p></div><div><span>改写范围</span><p>${escapeHtml(plan.production.copyright_boundary.rewrite_scope)}</p></div></div></details>
    <div class="result-actions"><button class="btn ghost export-md">${icon('arrow', 16)} 导出 Markdown</button><button class="btn ghost export-json">${icon('database', 16)} 导出 JSON</button></div>`
  // 导出 Markdown：人类可读，含完整字段和版权边界
  card.querySelector('.export-md').addEventListener('click', () => {
    try {
      downloadText(`${buildRemixFileName(plan)}.md`, buildRemixMarkdown(plan), 'text/markdown;charset=utf-8')
      // D2 埋点：导出视为专业使用意图，记录格式和方案特征
      track('idea_exported', { ideaId: plan.id, payload: { format: 'markdown', duration: plan.duration } })
      toast('Markdown 已导出')
    } catch (error) {
      toast('导出失败：' + (error?.message ?? error))
    }
  })
  // 导出 JSON：机器可读，保存完整 RemixPlan 字段
  card.querySelector('.export-json').addEventListener('click', () => {
    try {
      downloadText(`${buildRemixFileName(plan)}.json`, buildRemixJson(plan), 'application/json;charset=utf-8')
      track('idea_exported', { ideaId: plan.id, payload: { format: 'json', duration: plan.duration } })
      toast('JSON 已导出')
    } catch (error) {
      toast('导出失败：' + (error?.message ?? error))
    }
  })
}

// D5：通用重新加载逻辑——从收藏或历史的 entry 恢复选择器并渲染保存的 plan。
// 提取自 loadSavedRemix，供 loadHistoryRemix 复用，避免重复代码。
const loadRemixFromEntry = (entry, ctx, errorLabel, successPrefix) => {
  if (!entry?.plan || !entry.context) {
    toast(errorLabel)
    return
  }
  const { characterAId, characterBId, momentId, styleId } = entry.context
  const selectA = document.querySelector('#character-a')
  const selectB = document.querySelector('#character-b')
  const momentSelect = document.querySelector('#moment')
  const styleSelect = document.querySelector('#style')
  selectA.value = characterAId
  selectB.value = characterBId
  momentSelect.value = momentId
  styleSelect.value = styleId
  // 知识库变更后，收藏/历史中的实体可能已被删除；任一选择器为空时拒绝加载
  if (!selectA.value || !selectB.value || !momentSelect.value || !styleSelect.value) {
    toast('方案中的角色或场面已不在知识库中')
    return
  }
  document.querySelectorAll('[data-duration]').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.duration) === entry.plan.duration)
  })
  setDuration(entry.plan.duration)
  const a = characterById.get(characterAId)
  const b = characterById.get(characterBId)
  const moment = knowledge.iconic_moments.find((m) => m.id === momentId)
  const style = remixStyles.find((s) => s.id === styleId)
  const result = { plan: entry.plan, a, b, moment, style, seed: entry.seed ?? '' }
  setCurrentResult(result)
  renderResult(result, ctx)
  updateHints()
  document.querySelector('#remix').scrollIntoView({ behavior: 'smooth', block: 'start' })
  toast(`${successPrefix}：${entry.title}`)
}

// 把已收藏的方案重新加载到工作台：恢复选择器状态并直接渲染保存的 plan，避免 seed 变化产生不同方案
const loadSavedRemix = (id, ctx) => {
  const { saved } = getState()
  const item = saved.find((s) => s.id === id)
  loadRemixFromEntry(item, ctx, '该收藏无法重新加载', '已重新加载')
}

// D5：把历史记录中的方案重新加载到工作台，逻辑与 loadSavedRemix 一致
const loadHistoryRemix = (id, ctx) => {
  const item = getHistory().find((h) => h.id === id)
  loadRemixFromEntry(item, ctx, '该历史记录无法重新加载', '已从历史重新加载')
}

// 随机切换 4 个选择器，并自动生成方案
const randomize = (ctx) => {
  const selects = ['#character-a', '#character-b', '#moment', '#style'].map((selector) =>
    document.querySelector(selector),
  )
  selects.forEach((select) => {
    select.selectedIndex = Math.floor(Math.random() * select.options.length)
  })
  if (selects[0].value === selects[1].value)
    selects[1].selectedIndex = (selects[1].selectedIndex + 1) % selects[1].options.length
  updateHints()
  incrementGeneration()
  const result = buildRemix()
  setCurrentResult(result)
  renderResult(result, ctx)
  // D5：随机生成也记录到历史
  recordHistory(result)
  ctx.renderHistory?.()
  toast('已随机换一组内容基因')
}

// 把详情视图中的实体带入跨作品混搭工作台，自动避免 A / B 选到同一角色
const applyToRemix = (type, id, slot) => {
  const remixSection = document.querySelector('#remix')
  const selectA = document.querySelector('#character-a')
  const selectB = document.querySelector('#character-b')
  const momentSelect = document.querySelector('#moment')

  if (type === 'characters') {
    const target = slot === 'b' ? selectB : selectA
    target.value = id
    if (selectA.value === selectB.value) {
      const other = knowledge.known_characters.find((c) => c.id !== selectA.value)
      if (other) (slot === 'b' ? selectA : selectB).value = other.id
    }
    updateHints()
    remixSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast(`已把 ${characterById.get(id).name} 填入角色 ${slot === 'b' ? 'B' : 'A'}`)
  } else if (type === 'moments') {
    momentSelect.value = id
    updateHints()
    remixSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast(`已带入名场面：${knowledge.iconic_moments.find((item) => item.id === id).name}`)
  } else if (type === 'works') {
    // 作品没有直接对应的工作台字段，把该作品首个角色填入角色 A
    const character = knowledge.known_characters.find((c) => c.work_id === id)
    if (!character) {
      toast('该作品暂无可带入的角色')
      return
    }
    selectA.value = character.id
    if (selectA.value === selectB.value) {
      const other = knowledge.known_characters.find((c) => c.id !== selectA.value)
      if (other) selectB.value = other.id
    }
    updateHints()
    remixSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast(`已带入《${workById.get(id).title}》的 ${character.name}`)
  }
}

/**
 * 挂载工作台 section：绑定表单、随机、时长切换等事件。
 * ctx 提供：setSaved（写入 store 并同步 localStorage）、renderSaved（通知 SavedList 刷新）、
 *           renderHistory（通知 HistoryList 刷新）
 * 返回 API：{ updateHints, loadSavedRemix, loadHistoryRemix, applyToRemix }，
 *           供 SavedList / HistoryList / DetailView 跨 section 调用
 */
export const mountRemixWorkbench = (ctx) => {
  // 表单提交：generation 计数器 +1 后生成新方案
  document.querySelector('#remix-form').addEventListener('submit', (event) => {
    event.preventDefault()
    incrementGeneration()
    const result = buildRemix()
    setCurrentResult(result)
    renderResult(result, ctx)
    // D5：用户主动生成时记录到创作历史；初始挂载的默认方案不记录
    recordHistory(result)
    ctx.renderHistory?.()
    toast('新的跨界方案已生成')
  })

  document.querySelector('.randomize').addEventListener('click', () => randomize(ctx))

  // 时长切换：单选按钮互斥
  document.querySelectorAll('[data-duration]').forEach((button) =>
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-duration]').forEach((item) => item.classList.remove('active'))
      button.classList.add('active')
      setDuration(Number(button.dataset.duration))
    }),
  )

  // 选择器变化时更新提示
  document
    .querySelectorAll('#character-a,#character-b,#moment')
    .forEach((select) => select.addEventListener('change', updateHints))

  // 初始化：渲染提示 + 默认方案（不记录历史，避免页面加载就产生历史条目）
  updateHints()
  const result = buildRemix()
  setCurrentResult(result)
  renderResult(result, ctx)

  return {
    updateHints,
    loadSavedRemix: (id) => loadSavedRemix(id, ctx),
    loadHistoryRemix: (id) => loadHistoryRemix(id, ctx),
    applyToRemix,
  }
}
