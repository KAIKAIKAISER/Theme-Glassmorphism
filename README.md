# Glassmorphism for CF-Server-Monitor

![Glassmorphism 主题首页预览](preview.png)

本项目将 [Gongsc/Theme-Glassmorphism](https://github.com/Gongsc/Theme-Glassmorphism) 主题移植适配至 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。

保留原版精致的毛玻璃拟态外观、微质感配色与丰富的卡片视图，针对 Cloudflare 无服务器环境完成全量架构升级。

## 核心特性与适配改进

- **适配 CF-Server-Monitor API & WebSocket**：
  - 数据源改为由 Cloudflare Workers + D1 数据库提供；
  - 原生支持 WebSocket 增量实时推送（`batchUpdate`）与节流合并，严格遵循零 D1 轮询铁律。
- **彻底去除旋转地球与 3D 依赖**：
  - 剔除 Three.js、Cobe 与 Globe.gl 3D 渲染，彻底消除高 CPU/GPU 占用与电量消耗；
  - 首页头部自动重排为自适应双行/单行数据横幅，首屏秒开，轻量流畅。
- **原生支持 V4/V6 三网 6 线路延迟直显**：
  - 自动绑定 CF 探针的 6 条线路：
    - 电信 V4 (`ct`) / 联通 V4 (`cu`) / 移动 V4 (`cm`)
    - 电信 V6 (`node_1`) / 联通 V6 (`node_2`) / 移动 V6 (`node_3`)
  - 包含 20 格历史色条与丢包率汇总，支持延迟数值与 Sparkline 折线图双模式切换。
- **隐私加固**：
  - 彻底阻断 WebRTC 浏览器指纹嗅探，保障访客隐私。

## 使用方式（在 CF-Server-Monitor 中启用）

1. 进入 CF-Server-Monitor 管理后台：`/admin#/admin`
2. 依次点击 **外观设置 / 主题商店** -> **自定义主题 GitHub tree 地址**；
3. 填入本仓库 `dist` 分支地址：
   ```text
   https://github.com/KAIKAIKAISER/Theme-Glassmorphism/tree/dist
   ```
4. 点击保存，刷新前台首页即可享受全新 Glassmorphism 毛玻璃主题！

## 开发与构建

```sh
npm install
npm run build     # 编译产物输出至 dist/
```
每次向 `main` 分支提交代码，GitHub Actions 会自动编译并同步推送到 `dist` 分支。
