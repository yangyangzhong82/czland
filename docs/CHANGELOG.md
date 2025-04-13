# 更新日志

## [1.7.3] - 2025-04-13

### ✨ 新功能 (Features)

*   **玩家选择器增强**:
    *   在转让领地、添加/移除管理员、添加成员、领地列表等多个表单中，增加了 **[显示所有玩家]** 开关。用户可以选择仅查看最近活跃的玩家（默认）或查看服务器记录的所有离线玩家，方便管理不常在线的玩家。(OperationForms, areaAdmin, permissionform, czareaprotection)
    *   添加成员表单现在会显示玩家的 **最后登录时间**。(permissionform)
*   **批量操作**:
    *   添加管理员和添加成员表单现在支持 **多选玩家** 进行批量操作，显著提高管理效率。(areaAdmin, permissionform)

### ⚡ 优化 (Optimizations)

*   **权限检查性能**:
    *   大幅优化了 `checkPermission` 函数的性能。通过为玩家特定权限、区域默认权限组和自定义权限组添加 **缓存机制**，并使用 **预编译的数据库语句** 来减少查询开销。(permission)
    *   引入 `resetCache` 函数，在权限设置、默认组更改或自定义组编辑后自动 **清理相关缓存**，保证权限判断的及时性和准确性。(permission, OperationForms, areaAdmin, permissionform)
*   **表单交互**: 改进了涉及玩家列表的表单在翻页和搜索时对已选玩家状态的保持逻辑。(areaAdmin, permissionform)

### 🐛 修复 (Fixes)

*   **领地转让**: 修复了在转让领地时，未正确检查接收方是否超出 **总领地大小限制** (`maxTotalAreaSizePerPlayer`) 的问题。(OperationForms)
*   **权限逻辑**: 修复了 `checkPermission` 中处理父区域权限和默认权限组时的一些潜在逻辑问题。(permission)
*   **配置路径**: 调整了空间索引区块大小 (`chunkSize`) 的配置项路径，从 `spatialIndex.chunkSize` 更改为 `performance.chunkSize`，请注意更新你的配置文件。(spatialIndex, configManager)

### 🛠️ 内部改进 (Internal)

*   代码结构微调和日志记录改进。
*   更新部分模块以使用 `PlayerData` 插件提供的 `getRecentPlayers` API。
