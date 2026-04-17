# con-oo-starswishes - Review

## Review 结论

当前实现已经把 `Sudoku` / `Game` 真实接入了 Svelte 主流程，开始游戏、渲染局面、输入、Undo/Redo 都不再直接操作旧二维数组，这一点是达标的。但从设计质量看，领域边界仍然不够稳：`Game` 向外暴露了可变内部对象，组件层还保留了一部分关键交互规则，导致 OOD 和响应式边界存在被绕开的风险。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | good |
| Sudoku Business | good |
| OOD | fair |

## 缺点

### 1. 可变领域对象被直接暴露，破坏聚合边界

- 严重程度：core
- 位置：src/domain/game.js:16-18, src/node_modules/@sudoku/stores/game.js:100-102
- 原因：`Game.getSudoku()` 返回内部 `Sudoku` 实例，`gameStore` 还额外暴露了 `getDomainGame()`。这意味着调用方可以绕过 `game.guess()/undo()/redo()` 直接修改领域对象；一旦这么做，历史栈不会记录，store 的 `sync()` 也不会触发，Undo/Redo 和 Svelte 响应式边界都会失效。对 `Game` 这种聚合根来说，这是核心设计缺口。

### 2. 关键游戏规则仍散落在组件层

- 严重程度：major
- 位置：src/components/Controls/Keyboard.svelte:10-25, src/components/Controls/ActionBar/Actions.svelte:12-19
- 原因：组件在调用 `gameStore` 之前自行决定是否清除 candidates、notes 模式下是否先把格子写回 0，再由 store/domain 执行 `guess`。这样 `gameStore.guess()` 并不是完整的 UI 操作入口，组件必须记住额外副作用才不会把状态弄乱，不符合作业里“关键逻辑不要继续主要写在 `.svelte` 文件里”的要求。

### 3. 反序列化没有维护题面 givens 不可变的不变量

- 严重程度：major
- 位置：src/domain/sudoku.js:10-12, src/domain/utils.js:51-63
- 原因：`createSudoku` / `createSudokuFromJSON` 只校验了 9x9 结构和数字范围，没有校验 `currentGrid` 是否保留 `puzzleGrid` 的固定数字。外部 JSON 完全可以构造出“题面给定数字已被改写”的 `Sudoku`，这会让领域对象接受业务上不可能的状态。

### 4. 工厂对象方法依赖动态 this，上下文较脆弱

- 严重程度：minor
- 位置：src/domain/sudoku.js:31,49
- 原因：在闭包工厂对象里通过 `this.isFixedCell()` 和 `this.toJSON()` 访问其它方法，不是 JS 中最稳妥的写法；一旦方法被解构或作为回调传递，就会丢失上下文。这里更适合直接调用闭包内的局部函数或变量。

### 5. 组件顶层手动订阅缺少释放，偏离 Svelte 常见习惯

- 严重程度：minor
- 位置：src/App.svelte:12-17
- 原因：`gameWon.subscribe(...)` 写在组件脚本顶层且没有保存并释放 `unsubscribe`。根组件通常只挂载一次，所以当前风险不大，但从 Svelte 架构习惯看，更稳妥的是用 `$gameWon` 配合 reactive statement，或在销毁时显式清理订阅。

## 优点

### 1. 使用了明确的 Store Adapter，把领域对象桥接给 Svelte

- 位置：src/node_modules/@sudoku/stores/game.js:23-108
- 原因：`createGameStore()` 内部持有 `Game`，对外暴露可订阅的 view model 和 `guess/undo/redo/startNew/startCustom` 等命令，基本符合作业推荐的 adapter 方案，也解释了 UI 为什么能随领域变化而刷新。

### 2. 真实游戏主流程已经消费领域对象，而不是只在测试里存在

- 位置：src/components/Board/index.svelte:39-50, src/components/Controls/Keyboard.svelte:18-24, src/components/Controls/ActionBar/Actions.svelte:25-31, src/components/Modal/Types/Welcome.svelte:16-24
- 原因：棋盘渲染读取 `$gameStore.grid` / `$gameStore.puzzleGrid`，输入通过 `gameStore.guess()`，Undo/Redo 通过 `gameStore.undo()/redo()`，开始新局通过 `startNew/startCustom` 创建新的 `Game` / `Sudoku`。这说明领域层确实进入了真实 UI 流程。

### 3. Undo/Redo 历史职责明确放在 Game 中

- 位置：src/domain/game.js:20-31, src/domain/game.js:33-55, src/domain/game.js:65-70
- 原因：`Game` 在成功 `guess` 前记录快照、在新操作后清空 redo、并且把序列化历史纳入 `toJSON()`，职责边界总体清楚，符合“由 Game 管历史”的要求。

### 4. Sudoku 保留了必要的领域能力和防御性复制

- 位置：src/domain/sudoku.js:15-21, src/domain/sudoku.js:40-60, src/domain/utils.js:69-126
- 原因：`Sudoku` 提供了 `getGrid`、固定格判断、冲突检查、完成判断、`toJSON()`、`toString()` 等能力，并且对输入/输出网格做了 defensive copy，避免了外部直接共享内部二维数组。

## 补充说明

- 本次结论仅基于静态阅读，未运行测试、未启动浏览器，也未实际点击 UI；关于“界面会刷新”的判断来自 `writable(set(createViewModel(game)))` 与组件对 `$gameStore` 的消费路径。
- 审查范围按要求限制在 `src/domain/*` 及其关联的 Svelte 接入代码，主要包括 `src/node_modules/@sudoku/stores/game.js`、`src/node_modules/@sudoku/game.js`、`src/App.svelte`、`src/components/Board/index.svelte`、`src/components/Controls/*`、`src/components/Modal/Types/Welcome.svelte`、`src/components/Header/Dropdown.svelte`。
- 未对运行时 UX、题库生成质量、求解器正确性和无关目录做结论；这些都不在本次静态 review 的证据范围内。
