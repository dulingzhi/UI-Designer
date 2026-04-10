# NOT in scope

- **纯前端 CSS 模拟魔兽渲染（CSS Mocking）**
  - 理由：我们的北极星目标是“原生 1:1 还原 FDF”。基于 WebGL/Rust 解析原生 MDX 和 BLP 才能杜绝所有的边角料误差。不再花费精力写“长得差不多”的 CSS 盒子。

- **多页面或多组件生态（Prefab/Component System）**
  - 理由：目前处于技术通路打通阶段（Milestone 2）。组件复用和打包系统是很棒的工程功能，但前提是单个元素的通信必须完美。推迟到 Milestone 3。

- **脱离 `DzAPI` 的内存注入（Memory Hooking）**
  - 理由：为了降低初始测试版的引擎版本适配风险，依然选择现有的第三方 API，不去尝试高风险、易出问题的黑入魔兽原生内存寻址。

- **全功能的事件编辑器（Event Editor）**
  - 理由：让按钮点下去能够出发技能等游戏内逻辑属于进阶触发器系统，目前的验证切入点仅仅是“UI 修改的热重载”。

---

# What already exists

- **Tauri 本地 IPC 和 Web 开发框架**
  - 本项目已经基于 React + TypeScript + Tauri 搭起了基础环境，`src/components/Canvas.tsx` 和 Store 架构已经重构完成。UI 修改和画布移动是现成的，可复用拉取坐标的动作。
- **魔兽本地插件底层 (DzAPI)**
  - 存在且可用的 `NetConnect`, `NetSend`, `NetClose`，这些 C++ 绑定可以直接复用于我们的 TCP 长连接实现，避免去裸写 Lua 的 socket 库。
- **KKWE 热加载探测逻辑**
  - 在 `docs/HOT_RELOAD_IMPLEMENTATION_SUMMARY.md` 中的 `-reload` 检测逻辑，我们部分思想可以复用来作为启动游戏测试服和注入 Lua 热重载脚本的开关。

---

# Dream state delta

  CURRENT STATE                  THIS PLAN                  12-MONTH IDEAL
  每次调整按键和背                 --->       Tauri 与 Web          --->    全站式 Web 预览 + 多实例组件库。
  景都要重新保存，打开测试地图      建立独立的 TCP 双向同   打开魔兽游戏就只是最后一步发布审核
  。盲猜 0.051 或 0.052 坐标。   步，秒级更新单个 UI 属性。 不再需要在游戏中查看 UI 是否对齐，
                                                          并且可以拖拽现成的“背包”、“天赋树”
                                                          模板一键热更新。

---

# Error & Rescue Registry

| METHOD/CODEPATH | WHAT CAN GO WRONG | EXCEPTION CLASS | RESCUED? | RESCUE ACTION | USER SEES |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rust TCP 监听启动** | 端口被占用 | `std::io::Error (EADDRINUSE)` | Y | 打印 Error 到 Tauri 控制台并抛给前台 | 连接灯亮红（连接错误） |
| **Lua TCP 连接中** | 游戏启动瞬间 Tauri 服务器还未就绪 | `Connection Refused` | Y | Lua 开启循环，每1秒重试一次连接 | 连接灯黄（等待游戏中）|
| **TCP 粘包解析** | 多个消息连在一起或半截包 | `JSONParseError` | Y | 采用 `Base64 + \n` 截断协议；只针对完整行解码，残包丢弃 | （如果是偶发）什么都感觉不到，下一帧覆盖 |
| **Lua `BlzFrameSetPoint`** | 用户操作了一个已被销毁的 Frame | `AccessViolation/Crash` | Y | 使用 Registry Map (id->pointer)，查不到拦截即可 | 页面一切正常，游戏不崩，只是改动对无效句柄不生效 |

---

# Failure Modes Registry

| CODEPATH | FAILURE MODE | RESCUED? | TEST? | USER SEES? | LOGGED? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Lua 脚本执行报错 | 发送了合法 JSON 但是类型错位导致执行期抛错 | Y | N | **连接灯绿，但游戏无反应，也没有通知** | N ← **CRITICAL GAP -> FIXED 以 TCP 回包 ACK 模式解决** |
| React 滑动过于频繁 | Tauri IPC 消息风暴，Rust 内存打满 | Y | N | 整体程序界面卡顿掉帧，CPU 飙升 | 短暂卡顿 |

*(通过引入双向 ACK 和 rAF 限帧，以上 Critical Gaps 已全部修补。)*

---

# Scope Expansion Decisions
- **已接受的想法:**
  - `A1` TCP 端口锁定。只能监听 127.0.0.1，不允许外网访问。
  - `A2` TCP 协议 Base64 化。解决魔兽经常包含换行符 `\n` 而导致的数据解析失效。
  - `A3` 双向 ACK。Lua 执行完后必须向 Tauri 回传执行结果。如果 Tauri 连续不收到 ACK，UI 连接灯转黄或红。
  - `A4` Registry Map 隔离保护。绝不直接在 Lua 通过字符串反查句柄对象来 `SetPoint`。
  - `A5` rAF 保护。所有的 React 滑动不触发数据，而是等浏览器 60Hz 循环到了再统一取一次脏数据。
- **放弃:** 没有多余。一切以 HOLD SCOPE 为主。

---

# Completion Summary

  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | HOLD_SCOPE                                   |
  | System Audit         | React端代码干净，UI/Domain Store 分离        |
  | Step 0               | 选择方案A(长连接) + HOLD_SCOPE 坚守边界      |
  | Section 1  (Arch)    | 发现了 Lua 长轮询的线程爆炸问题。确认 TCP。  |
  | Section 2  (Errors)  | 1 严重缺陷，TCP 粘包问题（已用 Base64+\n 解决）|
  | Section 3  (Security)| 发现本地端口裸奔，已限定 127.0.0.1           |
  | Section 4  (Data/UX) | 1 引擎闪退隐患，使用 Registry Map 防御空句柄 |
  | Section 5  (Quality) | rAF(60Hz) 防抖限制前端风暴                    |
  | Section 6  (Tests)   | 只缺基础的 E2E 容错测试                       |
  | Section 7  (Perf)    | 前后端限频和断开机制补全                      |
  | Section 8  (Observ)  | 双向 ACK 状态灯提升执行可见性                 |
  | Section 9  (Deploy)  | 极低部署风险                                  |
  | Section 10 (Future)  | Reversibility: 4/5, 可复用的网络库底座        |
  | Section 11 (Design)  | SKIPPED (纯架构和网络层调整)                  |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                            |
  | What already exists  | written                                      |
  | Dream state delta    | written                                      |
  | Error/rescue registry| 4 methods, 0 CRITICAL GAPS                   |
  | Failure modes        | 2 total, 0 CRITICAL GAPS                     |
  | TODOS.md updates     | (留待手动填入 TODOS)                          |
  | Scope proposals      | 0 proposed, 0 accepted (HOLD / REDUCTION)    |
  | CEO plan             | skipped (HOLD_SCOPE)                         |
  | Outside voice        | ran (claude - Outside 1A 2A 采纳)            |
  | Lake Score           | 4/4 recommendations chose complete option   |
  | Diagrams produced    | (ASCII管线在记录中)                           |
  | Stale diagrams found | 0                                            |
  | Unresolved decisions | 0                                            |
  +====================================================================+
