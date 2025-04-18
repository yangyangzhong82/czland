# 更新日志

## [1.7.4] - 2025-04-18

### ✨ 新功能 (Features)

*   **子区域权限继承**:
    *   新增子区域是否继承父区域权限的选项。现在可以在区域默认权限设置界面为子区域单独配置是否继承父区域的默认权限组。(permission, permissionform, database)
    *   `checkPermission` 逻辑重构以支持新的继承规则。(permission)
*   **经济系统**:
    *   新增 `economy.czmoneyCurrencyType` 配置项，允许指定 czmoney 使用的货币类型 (例如 "money" 或 "score")。(economy, configManager)
    *   改进了与 LLMoney 和计分板经济系统的兼容性。(economy)

### ⚡ 优化 (Optimizations)

*   **数据库结构**:
    *   移除了独立的 `default_groups` 表，将区域默认权限组设置 (`defaultGroupName`) 和新增的权限继承标志 (`inheritPermissions`) 直接存储在 `areas` 表中，简化了数据库结构和查询。(database, permission, permissionform)
*   **权限缓存**: 增加了子区域继承标志的缓存 (`inheritFlagCache`)，进一步提升权限检查性能。(permission)
*   **配置简化**: 移除了配置文件中部分冗余的方块ID正则表达式，简化配置。(configManager)

### 🐛 修复 (Fixes)

*   **区域显示**: 修复了创建子区域后，创建者的当前区域信息可能不会立即更新的问题。(subareaForms, czareaprotection)
*   **权限组使用查询**: 修复了查询权限组使用情况时，未正确从新的 `areas` 表查询默认权限组设置的问题。(permissionform, database)

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
