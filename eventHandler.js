
const { isInArea, getPriorityAreasAtPosition, checkAreasOverlap,matchesIdPattern } = require('./utils'); // 引入 checkAreasOverlap
const { getAreaData, getSpatialIndex } = require('./czareaprotection'); // 引入 getSpatialIndex
const { worldToChunkCoords } = require('./spatialIndex'); // 显式导入 worldToChunkCoords
const { checkPermission } = require('./permission');
const { PERMISSIONS } = require('./permissionRegistry');
const { loadConfig } = require('./configManager');
const config = loadConfig();
const iListenAttentively = require('../iListenAttentively-LseExport/lib/iListenAttentively.js');
const {logDebug, logInfo, logWarning, logError } = require('./logger');

/**
 * 检查玩家在指定位置是否有特定权限，使用空间索引优化
 * @param {Player} player - 玩家对象
 * @param {object} pos - 位置对象 {x, y, z, dimid}
 * @param {string} permissionId - 权限ID
 * @param {object} areaData - 所有区域数据
 * @param {object} spatialIndex - 空间索引
 * @returns {boolean} 是否有权限
 */
function checkPriorityPermission(player, pos, permissionId, areaData, spatialIndex) {
    // 使用空间索引获取该位置的所有区域（已按优先级排序）
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

    // 如果不在任何区域内，允许操作
    if (areasAtPos.length === 0) {
        logDebug("位置不在任何区域内，默认允许操作");
        return true;
    }

    // 遍历区域（按优先级排序，子区域优先）
    for (const areaInfo of areasAtPos) {
        const areaId = areaInfo.id;
        const area = areaInfo.area;

        logDebug(`检查区域 ${areaId} (${area.name}) 权限`);

        // 检查玩家是否有权限
        // 注意：checkPermission 内部需要 areaData，所以这里仍然传递它
        const hasPermission = checkPermission(player, areaData, areaId, permissionId);

        // 只要有一个区域允许，就立即返回允许
        if (hasPermission) {
            logDebug(`权限检查通过，区域 ${areaId} 授予权限`);
            return true;
        }
    }

    // 所有区域都不允许
    logDebug("所有相关区域均拒绝权限");
    return false;
}

// 监听玩家破坏方块事件
mc.listen("onDestroyBlock", function(player, block) {
    const pos = block.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`玩家 ${player.name} 尝试破坏方块 at (${pos.x}, ${pos.y}, ${pos.z})`);

    // 使用 checkPriorityPermission 进行权限检查
    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.BREAK.id, areaData, spatialIndex);
    logDebug(`权限检查结果: ${hasPermission}`);

    if (!hasPermission) {
        // 检查是否在任何区域内，如果不在则允许（checkPriorityPermission 已处理此情况）
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            player.tell("§c你没有权限在此区域破坏方块！");
            return false; // 明确在区域内且无权限，则阻止
        }
    }

    logDebug("允许破坏方块");
    return true; // 不在区域内或有权限，则允许
});

// 监听玩家放置方块事件
mc.listen("onPlaceBlock", function(player, block) {
    const pos = block.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`玩家 ${player.name} 尝试放置方块 at (${pos.x}, ${pos.y}, ${pos.z})`);

    // 使用 checkPriorityPermission 进行权限检查
    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.PLACE.id, areaData, spatialIndex);
    logDebug(`权限检查结果: ${hasPermission}`);

    if (!hasPermission) {
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            player.tell("§c你没有权限在此区域放置方块！");
            return false;
        }
    }

    logDebug("允许放置方块");
    return true;
});

// 监听容器交互
mc.listen("onOpenContainer", function(player, block) {
    const pos = block.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    // 先检查是否在任何受保护区域内
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length === 0) {
        return true; // 不在任何区域内，允许
    }

    // 根据不同容器类型检查权限
    let permissionId;
    logDebug(`方块在区域 ${areasAtPos[0].id} (${areasAtPos[0].area.name}) 内 (优先级最高)`);

    switch(block.type) {
        case "minecraft:chest":
            permissionId = PERMISSIONS.OPEN_CONTAINER.id;
            logDebug(`检测到箱子，需要权限: ${permissionId}`);
            break;
        case "minecraft:trapped_chest":
            permissionId = PERMISSIONS.OPEN_TRAPPEDCHEST.id;
            break;
        case "minecraft:ender_chest":
            permissionId = PERMISSIONS.OPEN_ENDERCHEST.id;
            break;
        case "minecraft:crafting_table":
            permissionId = PERMISSIONS.OPEN_CRAFTING.id;
            break;
        case "minecraft:enchanting_table":
            permissionId = PERMISSIONS.OPEN_ENCHANTING.id;
            break;
        case "minecraft:hopper":
            permissionId = PERMISSIONS.OPEN_HOPPER.id;
            break;
        case "minecraft:dispenser":
            permissionId = PERMISSIONS.OPEN_DROPPER.id; // 注意：这里可能是笔误，dispenser 对应 OPEN_DISPENSER
            break;
        case "minecraft:dropper":
            permissionId = PERMISSIONS.OPEN_DISPENSER.id; // 注意：这里可能是笔误，dropper 对应 OPEN_DROPPER
            break;
        case "minecraft:barrel":
            permissionId = PERMISSIONS.OPEN_BARREL.id;
            break;
        case "minecraft:furnace":
            permissionId = PERMISSIONS.OPEN_FURNACE.id;
            break;
        case "minecraft:blast_furnace":
            permissionId = PERMISSIONS.OPEN_BLAST_FURNACE.id;
            break;
        case "minecraft:smoker":
            permissionId = PERMISSIONS.OPEN_SMOKER.id;
            break;
        case "minecraft:cartography_table":
            permissionId = PERMISSIONS.OPEN_CARTOGRAPHY.id;
            break;
        case "minecraft:stonecutter":
            permissionId = PERMISSIONS.OPEN_STONECUTTER.id;
            break;
        case "minecraft:brewing_stand":
            permissionId = PERMISSIONS.OPEN_BREWING_STAND.id;
            break;
        case "minecraft:crafter":
            permissionId = PERMISSIONS.OPEN_CRAFTER.id;
            break;
        case "minecraft:beacon":
            permissionId = PERMISSIONS.OPEN_BEACON.id;
            break;
        case "minecraft:grindstone":
            permissionId = PERMISSIONS.OPEN_GRINDSTONE.id;
            break;
        default:
            // 如果是其他未明确定义的容器类型，使用通用权限
            permissionId = PERMISSIONS.OPEN_OTHER_CONTAINER.id;
            break;
    }

    // 检查潜影盒
    if(config.shulkerBoxTypes.includes(block.type)) {
        permissionId = PERMISSIONS.OPEN_SHULKER.id;
    }
    if(config.anvilTypes.includes(block.type)) {
        permissionId = PERMISSIONS.OPEN_ANVIL.id;
    }

    if(permissionId) {
        const hasPermission = checkPriorityPermission(player, pos, permissionId, areaData, spatialIndex);
        if(!hasPermission) {
            player.tell("§c你没有权限操作这个容器！");
            return false;
        }
    }

    return true; // 有权限或不需要特定权限
});

// 监听物品拾取
mc.listen("onTakeItem", function(player, item) {
    const pos = item.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.PICKUP_ITEMS.id, areaData, spatialIndex);
    if (!hasPermission) {
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            // player.tell("§c你没有权限在此区域拾取物品！"); // 拾取失败通常不需要提示
            return false;
        }
    }
    return true;
});

/*
// 监听丢弃物品事件
iListenAttentively.emplaceListener(
    "ila::mc::world::actor::player::PlayerDropItemAfterEvent",
    event => {
        const player = iListenAttentively.getPlayer(event["self"]);
        // logger.warn(event.toSNBT());
        // logger.warn(`，玩家: ${iListenAttentively.getPlayer(event["self"]).realName}, }`);

        const pos = player.pos;
        const areaData = getAreaData();
        const spatialIndex = getSpatialIndex(); // 获取空间索引

        const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.DROP_ITEMS.id, areaData, spatialIndex);
        if (!hasPermission) {
            const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
            if (areasAtPos.length > 0) {
                player.tell("§c你没有权限在此区域丢弃物品！");
                event["cancelled"] = true; //拦截
                return;
            }
        }
    },
    iListenAttentively.EventPriority.High
);
*/
/*

// 监听物品丢弃 (LLSE API - 如果需要的话)
mc.listen("onDropItem", function(player, item) {
    const pos = player.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.DROP_ITEMS.id, areaData, spatialIndex);
    if (!hasPermission) {
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            player.tell("§c你没有权限在此区域丢弃物品！");
            return false;
        }
    }
    return true;
});
*/
// 监听实体爆炸事件 (检查规则)
mc.listen("onEntityExplode", function(entity, pos) {
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`检测到实体爆炸事件 at (${pos.x}, ${pos.y}, ${pos.z}), 实体类型: ${entity.type}`);

    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length > 0) {
        const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
        const area = areaInfo.area;
        const areaId = areaInfo.id;

        // 根据实体类型判断允许规则
        let isAllowed = false;
        switch(entity.type) {
            case "minecraft:creeper": isAllowed = area.rules?.allowCreeperExplosion; break;
            case "minecraft:fireball": isAllowed = area.rules?.allowFireballExplosion; break;
            case "minecraft:ender_crystal": isAllowed = area.rules?.allowCrystalExplosion; break;
            case "minecraft:wither": isAllowed = area.rules?.allowWitherExplosion; break;
            case "minecraft:wither_skull":
            case "minecraft:wither_skull_dangerous": isAllowed = area.rules?.allowWitherSkullExplosion; break;
            case "minecraft:tnt_minecart": isAllowed = area.rules?.allowTntMinecartExplosion; break;
            case "minecraft:wind_charge_projectile": isAllowed = area.rules?.allowWindChargeExplosion; break;
            case "minecraft:breeze_wind_charge_projectile": isAllowed = area.rules?.allowBreezeWindChargeExplosion; break;
            default: isAllowed = area.rules?.allowOtherExplosion; break;
        }

        if(!isAllowed) {
            logDebug(`区域 ${areaId} 不允许 ${entity.type} 类型的爆炸`);
            return false; // 阻止爆炸
        }
    }
    return true; // 不在区域内或区域允许
});

// 监听方块爆炸事件 (检查规则)
mc.listen("onBlockExplode", function(source, pos) {
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`检测到方块爆炸事件 at (${pos.x}, ${pos.y}, ${pos.z}), 来源: ${source ? source.type : "unknown"}`);

    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length > 0) {
        const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
        const area = areaInfo.area;
        const areaId = areaInfo.id;

        // 检查区域是否允许方块爆炸
        if(!area.rules || !area.rules.allowBlockExplosion) {
            logDebug(`区域 ${areaId} (${area.name}) 不允许方块爆炸，已拦截`);
            return false; // 拦截爆炸
        }
    }

    logDebug("未找到需要保护的区域或区域允许，允许爆炸");
    return true;
});

// 监听火焰蔓延事件 (检查规则)
mc.listen("onFireSpread", function(pos) {
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`检测到火焰蔓延 at (${pos.x}, ${pos.y}, ${pos.z})`);

    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length > 0) {
        const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
        const area = areaInfo.area;
        const areaId = areaInfo.id;

        // 检查区域是否允许火焰蔓延
        if(!area.rules || !area.rules.allowFireSpread) {
            logDebug(`区域 ${areaId} 不允许火焰蔓延`);
            return false; // 阻止蔓延
        }
    }
    return true; // 不在区域内或区域允许
});

// 火焰尝试燃烧方块事件 (iListenAttentively)
iListenAttentively.emplaceListener(
    "ila::mc::world::FireTryBurnBlockBeforeEvent",
    event => {
        let dim = event["dimid"];
        let x = event["pos"][0];
        let y = event["pos"][1];
        let z = event["pos"][2];
        const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2) }; // 修正维度ID Nether=-1, End=1

        logDebug(`检测到火焰尝试燃烧方块 at (${x}, ${y}, ${z}) 维度: ${dim}`);

        const areaData = getAreaData();
        const spatialIndex = getSpatialIndex(); // 获取空间索引
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

        if (areasAtPos.length > 0) {
            const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
            const area = areaInfo.area;
            const areaId = areaInfo.id;

            // 检查区域是否允许火焰烧毁方块
            if(!area.rules || !area.rules.allowFireBurnBlock) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许火焰烧毁方块，已拦截`);
                event["cancelled"] = true;  // 拦截燃烧
                return;
            }
        }

        logDebug("允许火焰烧毁方块");
    },
    iListenAttentively.EventPriority.High
);

// 苔藓生长事件 (iListenAttentively)
iListenAttentively.emplaceListener(
    "ila::mc::world::level::block::MossGrowthBeforeEvent",
    event => {
        let dim = event["dimid"];
        let x = event["pos"][0];
        let y = event["pos"][1];
        let z = event["pos"][2];
        const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1) }; // 修正维度ID

        logDebug(`检测到苔藓生长 at (${x}, ${y}, ${z}) 维度: ${dim}`);

        const areaData = getAreaData();
        const spatialIndex = getSpatialIndex(); // 获取空间索引
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

        if (areasAtPos.length > 0) {
            const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
            const area = areaInfo.area;
            const areaId = areaInfo.id;

            // 检查区域是否允许苔藓生长
            if(!area.rules || !area.rules.allowMossGrowth) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许苔藓生长，已拦截`);
                event["cancelled"] = true;  // 拦截生长
                return;
            }
        }

        logDebug("允许苔藓生长");
    },
    iListenAttentively.EventPriority.High
);

// 幽匿催发体生成事件 (iListenAttentively)
iListenAttentively.emplaceListener(
    "ila::mc::world::level::block::SculkSpreadBeforeEvent",
    event => {
        let dim = event["dimid"];
        let x = event["selfPos"][0];
        let y = event["selfPos"][1];
        let z = event["selfPos"][2];
        const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1) }; // 修正维度ID

        // logDebug(`检测到幽匿催发体生成 at (${x}, ${y}, ${z}) 维度: ${dim}`);

        const areaData = getAreaData();
        const spatialIndex = getSpatialIndex(); // 获取空间索引
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

        if (areasAtPos.length > 0) {
            const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
            const area = areaInfo.area;
            const areaId = areaInfo.id;

            // 检查区域是否允许幽匿催发体生成
            if(!area.rules || !area.rules.allowSculkSpread) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许幽匿催发体生成，已拦截`);
                event["cancelled"] = true;  // 拦截生成
                return;
            }
        }

        // logDebug("允许幽匿催发体生成");
    },
    iListenAttentively.EventPriority.High
);
/*
// 液体流动事件
iListenAttentively.emplaceListener(
    "ila::mc::world::level::block::LiquidTryFlowBeforeEvent",
    event => {
        let dim = event["dimid"];
        let fromX = event["flowFromPos"][0];
        let fromY = event["flowFromPos"][1];
        let fromZ = event["flowFromPos"][2];
        let toX = event["pos"][0];
        let toY = event["pos"][1];
        let toZ = event["pos"][2];

        const fromPos = { x: fromX, y: fromY, z: fromZ, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1) };
        const toPos = { x: toX, y: toY, z: toZ, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1) };

        const areaData = getAreaData();
        const spatialIndex = getSpatialIndex(); // 获取空间索引

        const areasAtToPos = getPriorityAreasAtPosition(toPos, areaData, spatialIndex);
        const areasAtFromPos = getPriorityAreasAtPosition(fromPos, areaData, spatialIndex);

        const toAreaId = areasAtToPos.length > 0 ? areasAtToPos[0].id : null;
        const fromAreaId = areasAtFromPos.length > 0 ? areasAtFromPos[0].id : null;

        // 如果目标位置在区域内，而源头位置不在同一区域内（或不在任何区域内）
        if (toAreaId && toAreaId !== fromAreaId) {
            const areaInfo = areasAtToPos[0];
            const area = areaInfo.area;
            const areaId = areaInfo.id;

            // 检查区域是否允许外部液体流入
            if(!area.rules || !area.rules.allowLiquidFlow) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许外部液体流入，已拦截`);
                event["cancelled"] = true;  // 拦截流动
                return;
            }
        }
    },
    iListenAttentively.EventPriority.High
);
*/
// 压力板事件
mc.listen("onStepOnPressurePlate", function(entity, pressurePlate) {
    const pos = pressurePlate.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`检测到实体踩压力板 at (${pos.x}, ${pos.y}, ${pos.z})`);

    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length > 0) {
        const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
        const area = areaInfo.area;
        const areaId = areaInfo.id;

        // 如果是玩家，使用玩家权限处理
        if(entity.isPlayer()) {
            const player = entity.toPlayer();
            if(player) {
                logDebug(`玩家 ${player.name} 踩压力板，检查权限`);
                const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_PRESSURE_PLATE.id, areaData, spatialIndex);
                if(!hasPermission) {
                    player.tell("§c你没有权限在此区域使用压力板！");
                    return false;
                }
            }
        }
        // 如果是其他实体，检查区域是否允许实体踩压力板
        else {
            logDebug(`实体 ${entity.type} 踩压力板，检查区域规则`);
            if(!area.rules || !area.rules.allowEntityPressurePlate) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许实体踩压力板，已拦截`);
                return false;
            }
        }
    }

    return true; // 不在区域内或有权限/规则允许
});

// 乘骑事件
mc.listen("onRide", function(entity1, entity2) {
    const pos = entity2.pos; // 使用被骑乘实体的位置
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`检测到实体乘骑事件 at (${pos.x}, ${pos.y}, ${pos.z})`);

    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length > 0) {
        const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
        const area = areaInfo.area;
        const areaId = areaInfo.id;

        if(entity1.isPlayer()) {
            const player = entity1.toPlayer();
            if(player) {
                logDebug(`玩家 ${player.name} 尝试骑乘实体，检查权限`);
                const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.RIDE_ENTITY.id, areaData, spatialIndex);
                if(!hasPermission) {
                    player.tell("§c你没有权限在此区域骑乘生物！");
                    return false;
                }
            }
        }
        else {
            logDebug(`实体 ${entity1.type} 尝试骑乘，检查区域规则`);
            if(!area.rules || !area.rules.allowEntityRide) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许生物乘骑，已拦截`);
                return false;
            }
        }
    }

    return true; // 不在区域内或有权限/规则允许
});

// 凋灵破坏方块事件 (优化：可以先用索引粗略判断，再精确检查重叠)
mc.listen("onWitherBossDestroy", function(witherBoss, AAbb, aaBB) {
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    const destroyArea = {
        point1: { x: AAbb.x, y: AAbb.y, z: AAbb.z },
        point2: { x: aaBB.x, y: aaBB.y, z: aaBB.z },
        dimid: witherBoss.pos.dimid
    };

    // 粗略检查：获取凋灵位置可能影响的区域
    const candidateAreas = getPriorityAreasAtPosition(witherBoss.pos, areaData, spatialIndex);
    // TODO: 可以根据破坏范围扩大候选区域的查询范围，但这比较复杂，暂时先用中心点

    // 精确检查：遍历所有区域（或候选区域）进行重叠判断
    // 优化：如果候选区域列表不为空，可以只检查候选区域
    const areasToCheck = candidateAreas.length > 0 ? candidateAreas.map(a => a.id) : Object.keys(areaData);

    for(const areaId of areasToCheck) {
        const area = areaData[areaId];
        if (!area) continue; // 防御性编程

        // 维度不同，肯定不重叠
        if (area.dimid !== destroyArea.dimid) continue;

        // 使用 checkAreasOverlap 函数检查是否重叠
        if(checkAreasOverlap(destroyArea, area)) {
            // 检查区域是否允许凋灵破坏方块
            if(!area.rules || !area.rules.allowWitherDestroy) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许凋灵破坏方块，已拦截`);
                return false; // 拦截破坏行为
            }
        }
    }

    return true; // 没有重叠或重叠区域允许
});

// 生物自然生成事件
mc.listen("onMobTrySpawn", function(typeName, pos) {
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length > 0) {
        const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
        const area = areaInfo.area;
        const areaId = areaInfo.id;

        // 检查区域是否允许生物自然生成
        if(!area.rules || !area.rules.allowMobNaturalSpawn) {
            logDebug(`区域 ${areaId} (${area.name}) 不允许生物自然生成，已拦截 ${typeName}`);
            return false; // 拦截生成
        }
    }

    return true; // 不在区域内或区域允许
});

// 操作盔甲架事件
mc.listen("onChangeArmorStand", function(armorStand, player, slot) {
    const pos = armorStand.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.ARMOR_STAND.id, areaData, spatialIndex);
    if (!hasPermission) {
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            player.tell("§c你没有权限在此区域操作盔甲架！");
            return false;
        }
    }

    return true;
});

// 末影人拿起方块事件 (iListenAttentively)
iListenAttentively.emplaceListener(
    "ila::mc::world::actor::EndermanTakeBlockBeforeEvent",
    event => {
        let dim = event["dimid"];
        let x = event["pos"][0];
        let y = event["pos"][1];
        let z = event["pos"][2];
        const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1) }; // 修正维度ID

        logDebug(`检测到末影人拿起方块 at (${x}, ${y}, ${z}) 维度: ${dim}`);

        const areaData = getAreaData();
        const spatialIndex = getSpatialIndex(); // 获取空间索引
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

        if (areasAtPos.length > 0) {
            const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
            const area = areaInfo.area;
            const areaId = areaInfo.id;

            // 检查区域是否允许末影人拿起方块
            if(!area.rules || !area.rules.allowEndermanTakeBlock) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许末影人拿起方块，已拦截`);
                event["cancelled"] = true;  // 拦截操作
                return;
            }
        }

        logDebug("允许末影人拿起方块");
    },
    iListenAttentively.EventPriority.High
);

// 末影人放置方块事件 (iListenAttentively)
iListenAttentively.emplaceListener(
    "ila::mc::world::actor::EndermanLeaveBlockBeforeEvent",
    event => {
        let dim = event["dimid"];
        let x = event["pos"][0];
        let y = event["pos"][1];
        let z = event["pos"][2];
        const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1) }; // 修正维度ID

        logDebug(`检测到末影人放置方块 at (${x}, ${y}, ${z}) 维度: ${dim}`);

        const areaData = getAreaData();
        const spatialIndex = getSpatialIndex(); // 获取空间索引
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

        if (areasAtPos.length > 0) {
            const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
            const area = areaInfo.area;
            const areaId = areaInfo.id;

            // 检查区域是否允许末影人放置方块
            if(!area.rules || !area.rules.allowEndermanPlaceBlock) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许末影人放置方块，已拦截`);
                event["cancelled"] = true;  // 拦截操作
                return;
            }
        }

        logDebug("允许末影人放置方块");
    },
    iListenAttentively.EventPriority.High
);

// 爆炸事件处理(考虑爆炸范围) (iListenAttentively)
iListenAttentively.emplaceListener(
    "ila::mc::world::ExplosionBeforeEvent",
    event => {
        let radius = event["radius"];
        let x = event["pos"][0];
        let y = event["pos"][1];
        let z = event["pos"][2];
        let dim = event["dimid"];
        const explosionPos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1) }; // 修正维度ID

        logDebug(`检测到爆炸事件 at (${x}, ${y}, ${z}) 维度: ${dim}, 半径: ${radius}`);

        const areaData = getAreaData();
        const spatialIndex = getSpatialIndex(); // 获取空间索引
        let shouldPreventBlockDamage = false;

        // 优化：查询爆炸中心点及周围区块的候选区域
        // 这是一个简化的方法，更精确的方法需要计算爆炸球体与区域的相交
        const centerChunk = worldToChunkCoords(x, z); // 直接使用导入的函数
        const checkRadiusChunks = Math.ceil(radius / 16); // 估算需要检查的区块半径
        let candidateAreaIds = new Set();

        for (let cx = centerChunk.chunkX - checkRadiusChunks; cx <= centerChunk.chunkX + checkRadiusChunks; cx++) {
            for (let cz = centerChunk.chunkZ - checkRadiusChunks; cz <= centerChunk.chunkZ + checkRadiusChunks; cz++) {
                const chunkAreas = spatialIndex?.[explosionPos.dimid]?.[cx]?.[cz];
                if (chunkAreas) {
                    chunkAreas.forEach(id => candidateAreaIds.add(id));
                }
            }
        }

        logDebug(`爆炸事件候选区域数: ${candidateAreaIds.size}`);

        // 遍历候选区域，检查爆炸影响
        for (const areaId of candidateAreaIds) {
            const area = areaData[areaId];
            if (!area || area.dimid !== explosionPos.dimid) continue; // 检查区域存在性和维度

            // 创建区域的边界信息
            const minX = Math.min(area.point1.x, area.point2.x);
            const maxX = Math.max(area.point1.x, area.point2.x);
            const minY = Math.min(area.point1.y, area.point2.y);
            const maxY = Math.max(area.point1.y, area.point2.y);
            const minZ = Math.min(area.point1.z, area.point2.z);
            const maxZ = Math.max(area.point1.z, area.point2.z);

            // 简单的边界盒碰撞检测（比精确球体检测性能更好，但可能误判）
            const closestX = Math.max(minX, Math.min(explosionPos.x, maxX));
            const closestY = Math.max(minY, Math.min(explosionPos.y, maxY));
            const closestZ = Math.max(minZ, Math.min(explosionPos.z, maxZ));
            const distanceSquared = (closestX - explosionPos.x)**2 + (closestY - explosionPos.y)**2 + (closestZ - explosionPos.z)**2;

            // 如果爆炸范围与区域相交，并且区域不允许爆炸破坏
            if (distanceSquared <= radius * radius && (!area.rules || !area.rules.allowExplosionDamageBlock)) {
                 logDebug(`爆炸范围(${radius})与区域 ${areaId} (${area.name}) 重叠，不允许破坏方块`);
                 shouldPreventBlockDamage = true;
                 break; // 找到一个阻止的区域就足够了
            }
        }

        // 如果需要防止爆炸破坏方块
        if (shouldPreventBlockDamage) {
            event["breaking"] = false;  // 防止破坏方块，保留爆炸效果
            logDebug("爆炸被设置为不破坏方块");
        }
    },
    iListenAttentively.EventPriority.High
);

// 监听玩家攻击实体事件
mc.listen("onAttackEntity", function(player, entity) {
    const pos = entity.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`玩家 ${player.name} 尝试攻击实体 ${entity.type} at (${pos.x}, ${pos.y}, ${pos.z})`);

    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.ATTACK_ENTITY.id, areaData, spatialIndex);
    logDebug(`权限检查结果: ${hasPermission}`);

    if (!hasPermission) {
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            // player.tell("§c你没有权限在此区域攻击实体！"); // 攻击失败通常不需要提示
            return false;
        }
    }

    return true;
});

// 监听玩家攻击方块事件
mc.listen("onAttackBlock", function(player, block, item) {
    const pos = block.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`玩家 ${player.name} 尝试攻击方块 at (${pos.x}, ${pos.y}, ${pos.z})`);

    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.ATTACK_BLOCK.id, areaData, spatialIndex);
    logDebug(`权限检查结果: ${hasPermission}`);

    if (!hasPermission) {
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            // player.tell("§c你没有权限在此区域攻击方块！"); // 攻击失败通常不需要提示
            return false;
        }
    }

    return true;
});

// 监听玩家使用物品事件
mc.listen("onUseItem", function(player, item) {
    const pos = player.pos; // 使用玩家位置作为判断依据
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引
    
    logDebug(`玩家 ${player.name} 尝试使用物品 ${item.type} at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    // 获取这个位置的区域信息
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length === 0) {
        return true; // 不在任何区域内，允许操作
    }
    
    // 检查是否是特殊物品类型
    const itemTypes = config.itemTypes || {};
    let specialItemChecked = false; // 标记是否进行了特殊物品的权限检查
    
    // 1. 检查弓
    if (matchesIdPattern(item.type, itemTypes.bow)) {
        logDebug("检测到使用弓");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_BOW.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用弓！");
            return false;
        }
    }
    
    // 2. 检查弩
    if (matchesIdPattern(item.type, itemTypes.crossbow)) {
        logDebug("检测到使用弩");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_CROSSBOW.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用弩！");
            return false;
        }
    }
    
    // 3. 检查三叉戟
    if (matchesIdPattern(item.type, itemTypes.trident)) {
        logDebug("检测到使用三叉戟");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_TRIDENT.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用三叉戟！");
            return false;
        }
    }
    
    // 4. 检查普通药水
    if (matchesIdPattern(item.type, itemTypes.potion)) {
        logDebug("检测到使用药水");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_POTION.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用药水！");
            return false;
        }
    }
    
    // 5. 检查喷溅药水
    if (matchesIdPattern(item.type, itemTypes.splashPotion)) {
        logDebug("检测到使用喷溅药水");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_SPLASH_POTION.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用喷溅药水！");
            return false;
        }
    }
    
    // 6. 检查滞留药水
    if (matchesIdPattern(item.type, itemTypes.lingeringPotion)) {
        logDebug("检测到使用滞留药水");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_LINGERING_POTION.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用滞留药水！");
            return false;
        }
    }
    
    // 7. 检查经验瓶
    if (matchesIdPattern(item.type, itemTypes.expBottle)) {
        logDebug("检测到使用附魔之瓶");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_EXP_BOTTLE.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用附魔之瓶！");
            return false;
        }
    }
    
    // 8. 检查钓鱼竿
    if (matchesIdPattern(item.type, itemTypes.fishingRod)) {
        logDebug("检测到使用钓鱼竿");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_FISHING_ROD.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用钓鱼竿！");
            return false;
        }
    }
    
    // 如果不是特殊物品，或者特殊物品检查不通过，才检查通用权限
    if (!specialItemChecked) {
        // 最后检查通用的使用物品权限
        const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_ITEM.id, areaData, spatialIndex);
        logDebug(`通用使用物品权限检查结果: ${hasPermission}`);
        
        if (!hasPermission) {
            player.tell("§c你没有权限在此区域使用物品！");
            return false;
        }
    }
    
    return true; // 允许操作
});

// 监听玩家对方块使用物品事件
mc.listen("onUseItemOn", function(player, item, block, side, pos) {
    const blockPos = block.pos; // 使用方块位置
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引
    
    logDebug(`玩家 ${player.name} 尝试对方块 ${block.type} 使用物品 ${item.type} at (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`);
    
    // 获取这个位置的区域信息
    const areasAtPos = getPriorityAreasAtPosition(blockPos, areaData, spatialIndex);
    if (areasAtPos.length === 0) {
        return true; // 不在任何区域内，允许操作
    }
    
    // 检查是否是特殊物品类型
    const itemTypes = config.itemTypes || {};
    const blockTypes = config.blockTypes || {};
    let specialItemChecked = false; // 标记是否进行了特殊物品的权限检查
    
    // 1. 检查是否是锹对特定方块的操作
    if (matchesIdPattern(item.type, itemTypes.shovel) && 
        matchesIdPattern(block.type, blockTypes.shovelable)) {
        logDebug("检测到锹对可铲方块的操作");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, blockPos, PERMISSIONS.USE_SHOVEL.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用铲子！");
            return false;
        }
    }
    
    // 2. 检查是否是斧对特定方块的操作
    if (matchesIdPattern(item.type, itemTypes.axe) && 
        matchesIdPattern(block.type, blockTypes.axeable)) {
        logDebug("检测到斧对可斧方块的操作");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, blockPos, PERMISSIONS.USE_AXE.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用斧头！");
            return false;
        }
    }
    
    // 3. 检查是否是锄头对特定方块的操作
    if (matchesIdPattern(item.type, itemTypes.hoe) && 
        matchesIdPattern(block.type, blockTypes.hoeable)) {
        logDebug("检测到锄对可锄方块的操作");
        specialItemChecked = true;
        const hasPermission = checkPriorityPermission(player, blockPos, PERMISSIONS.USE_HOE.id, areaData, spatialIndex);
        if (hasPermission) {
            return true; // 有权限则允许，不检查通用权限
        } else {
            player.tell("§c你没有权限在此区域使用锄头！");
            return false;
        }
    }
    
    // 如果不是特殊物品与方块的交互，才检查通用权限
    if (!specialItemChecked) {
        // 最后检查通用的对方块使用物品权限
        const hasPermission = checkPriorityPermission(player, blockPos, PERMISSIONS.USE_ITEM_ON_BLOCK.id, areaData, spatialIndex);
        logDebug(`通用对方块使用物品权限检查结果: ${hasPermission}`);
        
        if (!hasPermission) {
            player.tell("§c你没有权限在此区域对方块使用物品！");
            return false;
        }
    }
    
    return true; // 允许操作
});

// 监听玩家上床事件
mc.listen("onBedEnter", function(player, pos) {
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`玩家 ${player.name} 尝试上床 at (${pos.x}, ${pos.y}, ${pos.z})`);

    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_BED.id, areaData, spatialIndex);
    logDebug(`权限检查结果: ${hasPermission}`);

    if (!hasPermission) {
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            player.tell("§c你没有权限在此区域使用床！");
            return false;
        }
    }

    return true;
});

// 监听玩家使用钓鱼竿钓起实体事件
mc.listen("onPlayerPullFishingHook", function(player, entity, item) {
    const pos = entity.pos; // 使用被钓起实体的位置
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`玩家 ${player.name} 尝试钓起实体 at (${pos.x}, ${pos.y}, ${pos.z})`);

    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_FISHING_ROD.id, areaData, spatialIndex);
    logDebug(`权限检查结果: ${hasPermission}`);

    if (!hasPermission) {
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            player.tell("§c你没有权限在此区域使用钓鱼竿！");
            return false;
        }
    }

    return true;
});


mc.listen("onPlayerInteractEntity", function(player, entity, pos) {
        const entityPos = entity.pos;
        const areaData = getAreaData();
        const spatialIndex = getSpatialIndex(); // 获取空间索引

        logDebug(`玩家 ${player.name} 尝试与 与实体交互 (${entityPos.x}, ${entityPos.y}, ${entityPos.z})`);

        const hasPermission = checkPriorityPermission(player, entityPos, PERMISSIONS.INTERACT_ENTITY.id, areaData, spatialIndex);
        logDebug(`权限检查结果: ${hasPermission}`);

        if (!hasPermission) {
            const areasAtPos = getPriorityAreasAtPosition(entityPos, areaData, spatialIndex);
            if (areasAtPos.length > 0) {
                //player.tell("§c你没有权限在此区域交互实体！");
                return false;
            }
        }
    

    return true; // 不是展示框或有权限
});

mc.listen("onUseFrameBlock", function(player, block) {
    const blockPos = block.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`玩家 ${player.name} 尝试与 与实体交互 (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`);

    const hasPermission = checkPriorityPermission(player, blockPos, PERMISSIONS.ITEM_FRAME.id, areaData, spatialIndex);
    logDebug(`权限检查结果: ${hasPermission}`);

    if (!hasPermission) {
        const areasAtPos = getPriorityAreasAtPosition(blockPos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            //player.tell("§c你没有权限在此区域交互实体！");
            return false;
        }
    }


return true; // 不是展示框或有权限
});
