# 配置文件 (`config.json`)

插件的主要配置文件位于 `./plugins/area/config.json`。首次启动插件时会自动生成包含默认值的配置文件。

**重要提示**:
- 修改配置文件后，通常需要重启服务器才能生效。
- 配置文件使用 JSON 格式，请确保语法正确。
- 插件会自动检测配置文件版本，并在版本不匹配时尝试合并新旧配置，保留用户设置并添加新的默认值。建议在更新插件前备份此文件。

## 配置项详解

```json
{
    "version": "1.7.2", // 当前配置文件版本，请勿手动修改
    "spatialIndex": { 
        "chunkSize": 16 // 用于优化区域查找的区块大小，一般无需修改
    },
    "bsci": { // BSCI 可视化功能设置 (需要安装 BSCI 库)
        "enabled": true,         // 是否启用 BSCI 可视化功能 (选点、区域轮廓显示)
        "duration": 60,          // 可视化效果显示持续时间 (秒)
        "thickness": 0.1,        // 可视化线条的粗细
        "mainAreaColor": {       // 主区域轮廓颜色 (RGBA)
            "r": 0,
            "g": 191,
            "b": 255,
            "a": 255
        },
        "subAreaColor": {        // 一级子区域轮廓颜色 (RGBA)
            "r": 255,
            "g": 165,
            "b": 0,
            "a": 255
        },
        "subAreaLevel2Color": {  // 二级子区域轮廓颜色 (RGBA)
            "r": 148,
            "g": 0,
            "b": 211,
            "a": 255
        },
        "selectionPointColor": { // 使用选点工具 (`/area pos1`, `/area pos2`) 时显示的选区颜色 (RGBA)
            "r": 0,
            "g": 255,
            "b": 0,
            "a": 255
        }
    },
    "teleport": { // 区域传送功能设置
        "enabled": true, // 是否启用区域传送功能 (`/area tp <区域名>`)
        "costPerTeleport": 10, // 每次传送的基础费用 (如果经济系统启用)
        "teleportCooldown": 5, // 玩家每次传送的冷却时间 (秒)，0 或负数表示无冷却
        "preventTeleportIfInside": true, // 是否阻止玩家传送到他们当前所在的区域
        "economy": { // 传送使用的独立经济配置 (如果 `teleport.enabled` 为 true)
            "enabled": false, // 是否对传送收费
            "type": "money", // 经济类型: "money" (LLMoney), "scoreboard" (计分板), "czmoney" (假设存在此经济插件)
            "scoreboardObjective": "teleport_cost" // 当 type 为 "scoreboard" 时使用的计分板名称
        }
    },
    "itemTypes": { // 用于权限检查的物品分类 (通常无需修改)
        // ... (包含 minecart, shovel, axe, hoe, bucket, bow, crossbow, trident, potion, splashPotion, lingeringPotion, expBottle, fishingRod 等分类)
    },
    "blockTypes": { // 用于权限检查的方块分类 (通常无需修改)
        // ... (包含 daylightDetector, rails, cauldron, comparator, repeater, noteblock, jukebox, button, lever, composter, door, trapdoor, fenceGate, campfire, beehive, bookshelf, suspiciousBlock, respawnAnchor, candle, sign, dragonEgg, shovelable, axeable, hoeable, shulkerBox, anvil 等分类)
        // 注意: 部分分类使用了正则表达式，例如 /minecraft:.*_button/ 匹配所有按钮
    },
    "entityTypes": { // 用于权限检查的实体分类 (通常无需修改)
        // ... (包含 villagers, chestBoats, chestMinecarts, boats, minecarts, horses, animals, monsters, vehicles 等分类)
    },
    "debug": true, // 是否启用详细的调试日志输出 (仅在排查问题时开启)
    "toolSelector": { // 区域选点工具设置
        "enabled": false, // 是否启用选点工具 (例如，手持特定物品点击方块选点)
        "tool": "minecraft:stick"  // 选点工具的物品 ID (设为 null 或无效 ID 可禁用)
    },
    "displayAreaInfo": true, // 玩家进入区域时是否在屏幕上显示区域信息 (标题或 ActionBar)
    "areaInfoDisplayDuration": 5, // 区域信息显示持续时间 (秒，可能部分类型如 ActionBar 会持续显示)
    "maxAreasPerPlayer": 5, // 每个玩家可拥有的主区域数量限制 (-1 为不限制)
    "maxTotalAreaSizePerPlayer": -1, // 玩家可拥有的所有主区域的总方块体积限制 (-1 为不限制)
    "defaultGroupPermissions": [ // 新创建的区域或自定义权限组默认拥有的权限列表
        "break"
        // 更多可用权限请参考 permissions.md 文档
    ],
    "economy": { // 区域购买/出售经济系统设置
        "enabled": true, // 是否启用区域购买/出售经济功能
        "type": "money", // 经济类型: "money" (LLMoney), "scoreboard" (计分板)
        "scoreboardObjective": "money", // 当 type 为 "scoreboard" 时使用的计分板名称
        "pricePerBlock": 1, // 每个方块的基础价格 (用于计算区域价格)
        "priceByVolume": true, // 是否按体积 (长*宽*高) 计算价格，否则按面积 (长*宽)
        "priceByDimension": { // 不同维度的价格倍率
            "overworld": 1,   // 主世界倍率
            "nether": 1.5,    // 下界倍率
            "end": 2          // 末地倍率
        },
        "minPrice": 100, // 购买区域的最低价格
        "maxPrice": 1000000, // 购买区域的最高价格
        "refundRate": 0.7, // 删除区域时的退款比例 (0 到 1 之间，例如 0.7 表示退还 70%)
        "priceFormula": { // 自定义价格计算公式 (高级功能)
            "useCustom": false, // 是否启用自定义公式
            "formula": "length * width * height * pricePerBlock" // 自定义公式字符串，可用变量: length, width, height, pricePerBlock, dimensionMultiplier
        }
    },
    "areaSizeLimits": { // 区域尺寸限制设置
        "enabled": true, // 是否启用尺寸限制
        "min": { // 最小尺寸
            "x": 1,       // X 轴最小长度
            "y": 1,       // Y 轴最小高度
            "z": 1,       // Z 轴最小宽度
            "volume": 10  // 最小体积 (长*宽*高)
        },
        "max": { // 最大尺寸
            "x": 200,     // X 轴最大长度
            "y": 128,     // Y 轴最大高度
            "z": 200,     // Z 轴最大宽度
            "volume": 1000000 // 最大体积
        },
        "subarea": { // 子区域的尺寸限制
            "enabled": true, // 是否对子区域启用独立的尺寸限制
            "min": null,  // 子区域最小尺寸，为 null 时使用主区域的 min 配置
            "max": null   // 子区域最大尺寸，为 null 时使用主区域的 max 配置
        }
    },
    "forms": { // UI 表单相关设置
        "itemsPerPage": 20 // 表单 (如区域列表、权限列表) 每页显示的项目数量
    },
    "listenerControl": { // 核心事件监听器开关 (如果你不清楚，请不要修改！！！！)
        "onDestroyBlock": true,
        "onPlaceBlock": true,
        "onAttackBlock": true,
        "onBlockInteracted": true,
        "onOpenContainer": true,
        "onTakeItem": true,
        "onDropItem": true,
        "onAttackEntity": true,
        "onMobHurt": true,
        "mobHurtEffect": true,
        "onPlayerInteractEntity": true,
        "onRide": true,
        "onChangeArmorStand": true,
        "onUseFrameBlock": true,
        "onUseItem": true,
        "onUseItemOn": true,
        "onPlayerPullFishingHook": true,
        "onStepOnPressurePlate": true,
        "onBedEnter": true,
        "onEditSign": true,
        "onMobTrySpawn": true,
        "playerMovementCheck": true // 控制是否定时检查玩家移动以触发区域进入/离开事件
    },
    "ruleListenerControl": { // 特定游戏规则相关事件监听器开关
        // 控制是否监听处理爆炸、火焰蔓延、生物破坏等规则性事件
        "onEntityExplode": true,
        "onBlockExplode": true,
        "onFireSpread": true,
        "fireTryBurnBlock": true,
        "mossGrowth": true,
        "sculkSpread": true,
        "onWitherBossDestroy": true,
        "dragonEggTeleport": true,
        "fireworkDamage": true,
        "mobGriefing": true,
        "liquidFlow": true
    }
}
