# 插件 API

CzAreaProtection 提供了一系列 API 函数，供其他插件调用以实现与区域系统的交互。

## 导出命名空间

所有 API 函数都导出在 `CzAreaProtection` 命名空间下。

## 使用方法

在你的插件代码中，使用 `ll.imports` 来导入所需的 API 函数：

```javascript
// 示例：导入获取区域数据和检查权限的函数
const getAreaData = ll.imports("CzAreaProtection", "getAreaData");
const checkPermission = ll.imports("CzAreaProtection", "checkPermission");
const getAreaAtPosition = ll.imports("CzAreaProtection", "getAreaAtPosition");

// 然后在你的代码中使用这些函数
const allAreas = getAreaData();
const player = mc.getPlayer("SomePlayer");
const pos = player.pos;
const currentArea = getAreaAtPosition(pos);

if (currentArea && player) {
    const canBreak = checkPermission(player, allAreas, currentArea.id, "break");
    if (canBreak) {
        player.tell("你可以在这里破坏方块！");
    } else {
        player.tell("你不能在这里破坏方块！");
    }
}
```

## API 函数列表

---

### `getAreaData()`

-   **描述**: 获取当前加载的所有区域的数据。
-   **参数**: 无。
-   **返回**: `Object` - 一个以区域 ID 为键，区域数据对象为值的对象。请注意，直接修改此对象可能导致意外行为，建议将其视为只读。如果需要修改，请使用`modifyArea`API。
    ```json
    // 返回示例结构
    {
      "area_123": {
        "name": "主城",
        "point1": {"x": 0, "y": 60, "z": 0, "dimid": 0},
        "point2": {"x": 100, "y": 80, "z": 100, "dimid": 0},
        "dimid": 0,
        "xuid": "1234567890",
        "uuid": "player-uuid-string",
        "createTime": 1678886400000,
        "price": 10000
      },
      "sub_area_456": { ... } // 子区域数据
      // ... 其他区域
    }
    ```

---

### `getAreaInfo(areaId)`

-   **描述**: 获取指定 ID 的单个区域的详细数据。
-   **参数**:
    -   `areaId` (string): 要查询的区域 ID。
-   **返回**: `Object | null` - 区域的数据对象 (深拷贝)，如果区域不存在则返回 `null`。

---

### `getAllAreaIds()`

-   **描述**: 获取所有已加载区域的 ID 列表。
-   **参数**: 无。
-   **返回**: `string[]` - 包含所有区域 ID 的字符串数组。

---

### `getSpatialIndex()`

-   **描述**: 获取内部使用的空间索引数据结构。主要用于高级查询或调试，一般不建议直接操作。
-   **参数**: 无。
-   **返回**: `Object` - 空间索引对象。

---

### `getAreaAtPosition(position)`

-   **描述**: 获取指定坐标点处优先级最高的区域信息。
-   **参数**:
    -   `position` (Object): 坐标对象 `{x, y, z, dimid}`。
-   **返回**: `Object | null` - 最高优先级的区域数据对象 (深拷贝)，如果该位置不在任何区域内则返回 `null`。

---

### `getHighestPriorityArea(position, areaData, spatialIndex)`

-   **描述**: (底层函数) 根据给定的区域数据和空间索引，查找指定位置优先级最高的区域。`getAreaAtPosition` 是此函数的封装。
-   **参数**:
    -   `position` (Object): 坐标对象 `{x, y, z, dimid}`。
    -   `areaData` (Object): 完整的区域数据对象 (通常来自 `getAreaData()`)。
    -   `spatialIndex` (Object): 空间索引对象 (通常来自 `getSpatialIndex()`)。
-   **返回**: `Object | null` - 包含区域信息 `{id, area, depth, parentAreaId}` 的对象，如果不在任何区域则返回 `null`。

---

### `checkPermission(player, areaData, areaId, permission)`

-   **描述**: 检查指定玩家在指定区域是否拥有特定权限。这是核心的权限检查函数。
-   **参数**:
    -   `player` (Player | string): 玩家对象或玩家的 UUID。
    -   `areaData` (Object): 完整的区域数据对象 (通常来自 `getAreaData()`)。
    -   `areaId` (string): 要检查权限的区域 ID。
    -   `permission` (string): 要检查的权限 ID (例如: "break", "place", "manage")。
-   **返回**: `boolean` - 如果玩家拥有该权限则返回 `true`，否则返回 `false`。

---

### `checkAreaPermission(player, areaId, permissionId)`

-   **描述**: `checkPermission` 的一个简单封装，自动获取 `areaData`。
-   **参数**:
    -   `player` (Player | string): 玩家对象或玩家的 UUID。
    -   `areaId` (string): 要检查权限的区域 ID。
    -   `permissionId` (string): 要检查的权限 ID。
-   **返回**: `boolean` - 是否拥有权限。

---

### `getPlayerAreaGroup(playerUuid, areaId)`

-   **描述**: 获取玩家在指定区域被明确设置的权限组名称。
-   **参数**:
    -   `playerUuid` (string): 玩家的 UUID。
    -   `areaId` (string): 区域 ID。
-   **返回**: `string | null` - 权限组名称字符串，如果玩家在该区域没有被设置特定的权限组，则返回 `null` (此时会应用区域默认组或系统默认权限)。

---

### `getGroupPermissions(uniqueGroupId)`

-   **描述**: 获取指定自定义权限组包含的所有权限 ID 列表。
-   **参数**:
    -   `uniqueGroupId` (string): 权限组的唯一标识符，格式为 `"组名_创建者UUID"`。
-   **返回**: `string[] | null` - 包含权限 ID 的字符串数组，如果组不存在或标识符无效则返回 `null`。

---

### `getAvailablePermissionGroups()`

-   **描述**: 获取所有已创建的自定义权限组的唯一标识符列表。
-   **参数**: 无。
-   **返回**: `string[]` - 格式为 `"组名_创建者UUID"` 的字符串数组。

---

### `checkGroupPermission(uniqueGroupId, permissionId)`

-   **描述**: 检查指定的自定义权限组是否包含特定权限。
-   **参数**:
    -   `uniqueGroupId` (string): 权限组的唯一标识符 (`"组名_创建者UUID"`)。
    -   `permissionId` (string): 要检查的权限 ID。
-   **返回**: `boolean` - 如果组存在且包含该权限，则返回 `true`，否则返回 `false`。

---

### `createArea(creatorPlayer, areaName, point1, point2, parentAreaId = null)`

-   **描述**: 创建一个新区域（主区域或子区域）。会进行权限、限制和经济检查。
-   **参数**:
    -   `creatorPlayer` (Player): 创建区域的玩家对象。
    -   `areaName` (string): 新区域的名称。
    -   `point1` (Object): 第一个角点坐标 `{x, y, z, dimid}`。
    -   `point2` (Object): 第二个角点坐标 `{x, y, z, dimid}`。
    -   `parentAreaId` (string | null): (可选) 父区域 ID，如果创建的是子区域，则提供此 ID，否则为 `null`。
-   **返回**: `Promise<Object>` - 一个包含操作结果的对象:
    -   成功: `{ success: true, areaId: string }`
    -   失败: `{ success: false, error: string }`

---

### `modifyArea(modifierPlayer, areaId, modifications)`

-   **描述**: 修改一个已存在的区域。可以修改名称、范围、规则、所有者、优先级等。
-   **参数**:
    -   `modifierPlayer` (Player): 执行修改操作的玩家对象。
    -   `areaId` (string): 要修改的区域 ID。
    -   `modifications` (Object): 包含修改内容的对象。键可以是:
        -   `name` (string): 新名称。
        -   `point1` (Object): 新的角点1 `{x, y, z}` (必须同时提供 `point2`)。
        -   `point2` (Object): 新的角点2 `{x, y, z}` (必须同时提供 `point1`)。
        -   `rules` (Object): 新的规则对象 (将完全替换旧规则)。
        -   `owner` (Object): 新的所有者数据 `{uuid, xuid, name}`。
        -   `priority` (number): 新的优先级数值。
-   **返回**: `Promise<Object>` - 一个包含操作结果的对象:
    -   成功: `{ success: true }`
    -   失败: `{ success: false, error: string }`

---

### `deleteArea(deleter, areaId, force = false)`

-   **描述**: 删除一个区域。
-   **参数**:
    -   `deleter` (Player | string): 执行删除操作的玩家对象或其 UUID。
    -   `areaId` (string): 要删除的区域 ID。
    -   `force` (boolean): (可选, 默认 `false`) 是否强制删除。如果为 `true` 且区域包含子区域，会删除主区域但子区域可能成为孤立区域（需要管理员权限）。如果为 `false` 且包含子区域，则会失败。
-   **返回**: `Promise<Object>` - 一个包含操作结果的对象:
    -   成功: `{ success: true, refundedAmount?: number }` (如果经济系统启用了退款，会包含退款金额)
    -   失败: `{ success: false, error: string }`

---

### `getAreasByOwner(playerXuid)`

-   **描述**: 获取指定玩家 XUID 拥有的所有区域 ID 列表。
-   **参数**:
    -   `playerXuid` (string): 玩家的 XUID。
-   **返回**: `string[]` - 区域 ID 数组。

---

### `getAreasByOwnerUuid(playerUuid)`

-   **描述**: 获取指定玩家 UUID 拥有的所有区域 ID 列表。
-   **参数**:
    -   `playerUuid` (string): 玩家的 UUID。
-   **返回**: `string[]` - 区域 ID 数组。

---

### `_internal_createAreaFromData(ownerXuid, ownerUuid, areaName, point1, point2, dimid, teleportData = null)`

-   **描述**: [内部/迁移专用] 根据提供的数据创建一个新区域，跳过玩家对象相关的检查（权限、经济、玩家限制）。主要用于数据迁移场景。**不建议在常规插件交互中使用此函数。**
-   **参数**:
    -   `ownerXuid` (string): 所有者 XUID。
    -   `ownerUuid` (string | null): 所有者 UUID (如果可用)。
    -   `areaName` (string): 区域名称。
    -   `point1` (Object): 角点1 `{x, y, z}`。
    -   `point2` (Object): 角点2 `{x, y, z}`。
    -   `dimid` (number): 维度 ID。
    -   `teleportData` (Object | null): (可选) 旧的传送点数据 `{x, y, z}`。
-   **返回**: `Object` - 操作结果:
    -   成功: `{ success: true, areaId: string, message?: string }` (message 可能提示区域已存在)
    -   失败: `{ success: false, error: string }`
