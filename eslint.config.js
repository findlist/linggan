// ESLint flat config（ESLint 9+ 默认形式）。
// 项目用 ESM（package.json "type": "module"），因此本文件用 import/export。
// 目标：覆盖 .ts 与 .js 源码，关闭与 Prettier 冲突的格式规则，
// 让 Prettier 负责格式、ESLint 负责代码质量与潜在错误。

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  // 全局忽略：构建产物、依赖、运行时数据与采集批次不属于 lint 范围
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'data/**',
      'public/data/**',
      'memory/archive/**',
    ],
  },
  // JS 推荐规则：捕捉常见错误（未定义变量、未使用、空块等）
  js.configs.recommended,
  // TS 推荐规则（不带类型检查，只用语法）：捕捉 TS 特有问题
  ...tseslint.configs.recommended,
  // 项目通用语言选项与规则微调
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // TS 类型检查已覆盖未定义变量检测；JS 文件中浏览器/Node 全局较多，关闭避免误报
      'no-undef': 'off',
      // 项目允许 any（适配器、测试与原型的边界场景常用）
      '@typescript-eslint/no-explicit-any': 'off',
      // 部分脚本可能通过 createRequire 互操作 CommonJS
      '@typescript-eslint/no-require-imports': 'off',
      // 未使用变量为警告而非错误，下划线前缀豁免（约定俗成的占位符）
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  // 关闭与 Prettier 冲突的格式化规则，让 Prettier 统一格式
  prettierConfig,
)
