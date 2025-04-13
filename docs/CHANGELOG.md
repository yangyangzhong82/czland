# 更新日志

## [1.7.3] - 2025-04-13

### ✨ 新功能 (Features)

*   **玩家选择器增强**:
    *   在转让领地、添加/移除管理员、添加成员、领地列表等多个表单中，增加了 **[显示所有玩家]** 开关。用户可以选择仅查看最近活跃的玩家（默认30天）或查看服务器记录的所有离线玩家，方便管理不常在线的玩家。(OperationForms, areaAdmin, permissionform, czareaprotection)

### ⚡ 优化 (Optimizations)

*   **权限检查性能**:
    *   大幅优化了 `checkPermission` 函数的性能。通过为玩家特定权限、区域默认权限组和自定义权限组添加 **缓存机制**，并使用 **预编译的数据库语句** 来减少查询开销。(permission)
*   **表单交互**: 改进了涉及玩家列表的表单在翻页和搜索时对已选玩家状态的保持逻辑，便于批量选择。(areaAdmin, permissionform)

### 🐛 修复 (Fixes)
(OperationForms)
*   **权限逻辑**: 修复权限组添加后无可用的权限组添加的问题(permissionfrom)
*   **配置路径**: 调整了空间索引区块大小 (`chunkSize`) 的配置项路径，从 `spatialIndex.chunkSize` 更改为 `performance.chunkSize`，请注意更新你的配置文件。(spatialIndex, configManager)
*   **领地管理员**: 修复领地管理员不能正常添加只能添加一个的问题(areaAdmin)

