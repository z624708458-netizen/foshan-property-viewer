# 技术规范

## 技术栈

| 层级 | 技术 | 版本要求 |
|------|------|---------|
| 本地服务器 | Express (Node.js) | >= 4.21.0 |
| 前端框架 | React | >= 18.2.0 |
| 开发语言 | TypeScript | >= 5.0.0 |
| 构建工具 | Vite | >= 5.0.0 |
| UI组件库 | Ant Design | >= 5.0.0 |
| 图表库 | ECharts | >= 5.0.0 |
| CSS方案 | Tailwind CSS | >= 3.0.0 |
| 状态管理 | Zustand | >= 4.0.0 |
| 本地数据库 | sql.js (SQLite WebAssembly) | >= 1.10.0 |
| HTTP客户端 | axios | >= 1.6.0 |
| 定时任务 | node-cron | >= 3.0.0 |
| 打包工具 | electron-builder | >= 24.0.0 |
| 云端服务 | Supabase | JS SDK v2 |

## 开发环境

- 操作系统：Windows 10/11
- Node.js：>= 18.0.0
- 包管理器：npm（随 Node.js 安装）
- 代码编辑器：VS Code（推荐）

## 项目结构规范

```
foshan-property-viewer/
├── src/
│   ├── main/            # Electron 主进程代码（Node.js 环境）
│   ├── preload/         # Preload 脚本（桥接层）
│   └── renderer/       # React 前端代码（浏览器环境）
├── docs/               # 项目文档
├── devlog/             # 开发日志
├── resources/          # 静态资源（图标等）
├── package.json        # 项目配置
├── tsconfig.json       # TypeScript 配置
├── vite.config.ts      # Vite 构建配置
├── electron-builder.yml # 打包配置
└── tailwind.config.js  # Tailwind 配置
```

## 进程隔离规则

### 主进程（src/main/）
- 可访问 Node.js 全部 API
- 负责：窗口管理、数据采集、数据库操作、云端同步、定时任务
- 禁止：直接操作 DOM

### Preload（src/preload/）
- 使用 contextBridge 暴露安全 API 给渲染进程
- 禁止：直接暴露 Node.js API

### 渲染进程（src/renderer/）
- 运行在浏览器沙箱中
- 只能通过 window.electronAPI 调用主进程功能
- 负责：UI 渲染、用户交互

## 数据库规范

- 本地使用 SQLite，文件存放在用户数据目录
- 云端使用 Supabase PostgreSQL
- 表名使用 snake_case 复数形式
- 主键使用 TEXT 类型的 UUID
- 时间字段使用 ISO 8601 格式文本
- 所有外键必须建立索引

## 代码规范

- 使用 TypeScript 严格模式
- 函数命名：camelCase（如 getUserData）
- 组件命名：PascalCase（如 ProjectTable）
- 文件命名：kebab-case（如 project-table.tsx）
- 常量命名：UPPER_SNAKE_CASE（如 MAX_RETRY_COUNT）
- 每个文件不超过 300 行
- 每个函数不超过 50 行

## 采集规范

- 请求频率：每秒不超过 2 个请求
- 区域间隔：每个区域之间间隔 5 秒
- 重试策略：指数退避，最多 3 次
- User-Agent：模拟真实浏览器
- 增量采集：优先只请求有变化的数据
- 断点续采：支持从中断位置继续

## 安全规范

- 渲染进程禁止直接访问 Node.js API
- 云端 API Key 存储在环境变量中
- 用户密码使用 Supabase Auth 管理（不自行存储）
- HTTPS 强制用于所有网络请求
- SQL 使用参数化查询防止注入
