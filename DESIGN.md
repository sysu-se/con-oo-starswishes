# DESIGN

## A. 领域对象如何被消费

### 1. View 层直接消费什么

View 层直接消费的是一个面向 Svelte 的 adapter store: `gameStore`。

- 领域层在 `src/domain/index.js`
  - `createSudoku(...)`
  - `createGame(...)`
- 适配层在 `src/node_modules/@sudoku/stores/game.js`
  - 内部持有真正的 `Game`
  - 对外暴露可被 `$gameStore` 消费的响应式状态
  - 对外暴露 `guess / applyHint / undo / redo / startNew / startCustom`

也就是说，组件并不直接去改二维数组，而是：

1. 读 `$gameStore`
2. 调 `gameStore` 暴露的方法
3. 让 adapter 再去驱动 `Game` / `Sudoku`

### 2. View 层拿到的数据是什么

`gameStore` 每次都会把领域对象转换成一个 plain view model，当前暴露给 UI 的主要数据有：

- `puzzleGrid`
  - 原始题面
  - 用来判断一个格子是不是固定数字
- `grid`
  - 当前局面的可视化棋盘
- `invalidCells`
  - 当前冲突格子的坐标 key，格式是 `x,y`
- `won`
  - 当前是否已经完成且无冲突
- `canUndo`
  - 当前是否可以撤销
- `canRedo`
  - 当前是否可以重做
- `sencode`
  - 当前题面的分享编码

### 3. 用户操作如何进入领域对象

主要交互链路如下：

- 开始新游戏
  - `Welcome.svelte` / `Dropdown.svelte` 调 `@sudoku/game` 的 `startNew` 或 `startCustom`
  - `@sudoku/game` 再调用 `gameStore.startNew/startCustom`
  - `gameStore` 创建新的 `Game(createSudoku(...))`

- 棋盘渲染
  - `Board/index.svelte` 直接读取 `$gameStore.grid`
  - 是否是用户填写数字由 `$gameStore.puzzleGrid` 判断
  - 冲突高亮来自 `$gameStore.invalidCells`

- 用户输入
  - `Keyboard.svelte` 不再调用 `userGrid.set(...)`
  - 现在统一调用 `gameStore.guess({ row, col, value })`

- Hint
  - `Actions.svelte` 调 `gameStore.applyHint($cursor)`
  - adapter 计算答案，再通过 `game.guess(...)` 进入领域层

- Undo / Redo
  - `Actions.svelte` 调 `gameStore.undo()` / `gameStore.redo()`
  - 真正的历史管理在 `Game` 中完成

- 分享
  - `Share.svelte` 直接读 `$gameStore.sencode`

### 4. 为什么领域对象变化后，Svelte 会刷新

关键点不是“领域对象变了”，而是“adapter store 调用了 `set(...)` 并给了 Svelte 一个新的 view model”。

当前方案里：

1. `Sudoku` / `Game` 负责真正的业务逻辑
2. `gameStore` 在每次 `guess / undo / redo / startNew / startCustom` 后执行 `sync()`
3. `sync()` 会重新读取领域对象，重新组装一个新的 plain object
4. `writable.set(newViewModel)` 触发 `$gameStore` 的订阅更新
5. 所有消费 `$gameStore` 的组件重新渲染

所以，Svelte 刷新的直接原因是 store 更新，不是它“自动感知到了类或对象内部字段被改了”。

## B. 响应式机制说明

### 1. 依赖了哪些 Svelte 机制

本实现依赖的是 Svelte 3 的这些机制：

- `writable` custom store
- `derived` store
- 组件中的 `$store` 自动订阅
- 少量 `$:` reactive statement

具体分工：

- `gameStore`
  - 暴露领域层给 UI 的响应式边界
- `gameWon`
  - `derived(gameStore, ...)`
- `keyboardDisabled`
  - `derived([cursor, gameStore, gamePaused], ...)`
- `Share.svelte`
  - 用 `$:` 从 `$gameStore.sencode` 推导链接

### 2. 哪些数据以响应式方式暴露给 UI

响应式暴露给 UI 的核心数据：

- `gameStore.puzzleGrid`
- `gameStore.grid`
- `gameStore.invalidCells`
- `gameStore.won`
- `gameStore.canUndo`
- `gameStore.canRedo`
- `gameStore.sencode`
- `gamePaused`
- `cursor`
- `keyboardDisabled`

### 3. 哪些状态留在领域对象内部

保留在领域对象内部，而不是直接散落在组件里的状态：

- `Sudoku`
  - 原始题面 `puzzleGrid`
  - 当前局面 `currentGrid`
  - 固定格子规则
  - 冲突检测逻辑
  - 序列化/字符串化逻辑

- `Game`
  - 当前 `Sudoku`
  - undo history
  - redo history
  - 撤销/重做的状态转移规则

UI 看不到 `Game` 内部历史栈的结构，只能看到 `canUndo/canRedo` 和操作入口。

### 4. 如果直接 mutate 内部对象，会出什么问题

如果组件绕过 adapter，直接做这种事：

- 直接改 `Sudoku` 里的二维数组
- 直接改某个对象字段但不经过 `gameStore.set(...)`

会有两个问题：

1. Svelte 不会可靠地知道应该刷新
   - `$gameStore` 依赖的是 store 值
   - 它不会自动追踪任意对象内部字段变化

2. 响应式依赖会失去边界
   - 组件会重新开始依赖“谁记得去手动改数组”
   - 逻辑会重新散落回 `.svelte` 文件

这正是这次作业要避免的问题。

## C. 改进说明

### 1. 相比 HW1，我改进了什么

这次我做的核心改进有三项：

- `Sudoku` 现在同时持有“题面”和“当前局面”
  - 不再需要靠外部两个独立 store 才能知道哪个格子是固定数字

- `Game` 负责完整的 undo / redo
  - 历史存的是可序列化的 `Sudoku` snapshot
  - 不再依赖共享二维数组引用

- 增加了 `gameStore` 作为 Svelte adapter
  - View 读的是 adapter 暴露的状态
  - View 写的是 adapter 暴露的方法
  - 领域层真正进入了 Svelte 游戏流程

### 2. 为什么 HW1 的做法不足以支持真实接入

HW1 常见的问题是：

- `Sudoku` / `Game` 只存在于测试里
- 真正的界面仍然直接操作旧的 store 或旧数组
- undo / redo 或 guess 逻辑仍然散落在组件中

这种做法的问题不是“不能运行”，而是：

- 领域对象不是运行时核心
- View 没有真正消费领域对象
- 代码一旦继续演化，逻辑边界会越来越乱

### 3. 这套设计的 trade-off

优点：

- UI 和领域层职责边界清楚
- Svelte 响应式边界清楚
- undo / redo 更稳定，序列化更自然
- 测试和真实界面使用的是同一套领域对象

代价：

- adapter 会把领域状态重新投影成 view model，存在一层数据复制
- snapshot history 比只存“单步命令”更占内存
- `notes / candidates / cursor / hints` 仍然是 UI/session 层状态，没有放进领域层

我接受这些 trade-off，因为这次作业的重点是“真实接入 Svelte 流程”和“明确响应式边界”，不是做最极致的内存优化。

## 额外说明

如果以后迁移到 Svelte 5，最稳定的层应该仍然是：

- `src/domain/*`

最可能调整的是：

- `gameStore` 这层 adapter
- 少量组件中消费 store 的写法

也就是说，这次把领域层和 UI 层拆开，正是为了让未来迁移成本集中在边界层，而不是把整个应用一起重写。
