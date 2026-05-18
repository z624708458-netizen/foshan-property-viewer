# CLAUDE.md

## 项目概述
佛山楼盘数据查看器（Foshan Property Viewer）—— 一个 Windows 桌面软件，用于查看佛山市房产信息网上五个区（禅城、南海、顺德、三水、高明）的楼盘房源数据，支持价格历史追踪和云端同步。

## 技术栈
Node.js (Express 本地服务器) + React + TypeScript + Ant Design + sql.js (SQLite) + Supabase

---

## 标准文档路径

所有开发相关的标准文档位于 `docs/` 文件夹：

| 文档 | 路径 | 说明 |
|------|------|------|
| 开发需求 | [docs/requirements.md](docs/requirements.md) | 功能需求、非功能需求、版本规划 |
| 技术规范 | [docs/technical-spec.md](docs/technical-spec.md) | 技术栈、项目结构、代码规范、安全规范 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | 色彩、字体、布局、组件、交互规范 |
| 开发步骤 | [docs/development-plan.md](docs/development-plan.md) | 分阶段执行计划、每日工作流、检查点 |
| 架构设计 | [docs/architecture.md](docs/architecture.md) | 系统架构、数据流、数据库设计、IPC通信 |

## 开发日志
开发日志位于 `devlog/` 文件夹，按日期命名（如 `2026-05-12.md`）。每天工作结束后更新，记录：
- 已完成事项
- 待办事项
- 遇到的问题

---

## 工作原则

1. **循序渐进**：严格按照 [开发步骤](docs/development-plan.md) 的阶段顺序执行，不跳步，不贪多
2. **每步验证**：完成一个子任务后立即验证，确认无误再继续
3. **文档同步**：代码变更涉及架构或规范变化时，同步更新 docs/ 下的对应文档
4. **日志不落**：每天结束前更新 devlog/，记录当天进展
5. **中文沟通**：与用户的所有沟通使用简体中文

## 关键规则

- 前端通过 HTTP API 与本地 Express 服务器通信，不直接访问 Node.js API
- 采集请求频率：每秒不超过 2 个请求，区域间隔 5 秒
- 所有 SQL 使用参数化查询，防止注入
- 云端 API Key 通过环境变量管理，不硬编码
- 函数不超过 50 行，文件不超过 300 行
