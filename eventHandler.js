const { isInArea, getPriorityAreasAtPosition, checkAreasOverlap, matchesIdPattern, findNearestBoundaryPoint } = require('./utils'); // 引入 findNearestBoundaryPoint
const { getAreaData, getSpatialIndex } = require('./czareaprotection');
const { worldToChunkCoords } = require('./spatialIndex');
const { checkPermission } = require('./permission');
const { PERMISSIONS } = require('./permissionRegistry');
const { loadConfig } = require('./configManager');
const config = loadConfig(); // Load initial config, but reload in handlers if needed
const iListenAttentively = require('../iListenAttentively-LseExport/lib/iListenAttentively.js');
const { logDebug, logInfo, logWarning, logError } = require('./logger');
require('./ruleHandler'); // 引入规则处理器
const playerPositionHistory = {};

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
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length === 0) {
        logDebug(`位置 (${pos.x}, ${pos.y}, ${pos.z}) 不在任何区域内，权限 ${permissionId} 默认允许`);
        return true;
    }

    for (const areaInfo of areasAtPos) {
        const areaId = areaInfo.id;
        logDebug(`检查区域 ${areaId} (${areaInfo.area.name}) 权限 ${permissionId}`);
        if (checkPermission(player, areaData, areaId, permissionId)) {
            logDebug(`权限检查通过，区域 ${areaId} 授予权限 ${permissionId}`);
            return true;
        }
    }

    logDebug(`所有相关区域均拒绝权限 ${permissionId} at (${pos.x}, ${pos.y}, ${pos.z})`);
    return false;
}

/**
 * 通用的事件权限处理函数
 * @param {Player} player - 玩家对象
 * @param {object} pos - 事件发生的位置
 * @param {string} permissionId - 需要检查的权限ID
 * @param {string} actionDescription - 操作描述，用于日志
 * @param {string} [denialMessage] - 可选的权限不足提示信息
 * @returns {boolean} 是否允许操作
 */
function handlePermissionCheck(player, pos, permissionId, actionDescription, denialMessage) {
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex();
    logDebug(`玩家 ${player.name} 尝试 ${actionDescription} at (${pos.x}, ${pos.y}, ${pos.z})，检查权限 ${permissionId}`);

    const hasPermission = checkPriorityPermission(player, pos, permissionId, areaData, spatialIndex);
    logDebug(`权限检查结果 for ${permissionId}: ${hasPermission}`);

    if (!hasPermission) {
        // 只有当确实在区域内时才提示（checkPriorityPermission内部处理了不在区域的情况）
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0 && denialMessage) {
            player.tell(denialMessage);
        }
        // 如果不在区域内，hasPermission 会是 true，如果在了区域内但没权限，则返回 false
        return false;
    }

    logDebug(`允许 ${actionDescription}`);
    return true;
}

/**
 * 处理攻击实体/生物的权限检查逻辑
 * @param {Player} player - 攻击者
 * @param {Entity} targetEntity - 被攻击的实体
 * @returns {boolean} 是否允许攻击
 */
function handleAttackPermission(player, targetEntity) {
    const pos = targetEntity.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex();
    const currentConfig = loadConfig(); // 重新加载以获取最新配置

    logDebug(`玩家 ${player.name} 尝试攻击实体 ${targetEntity.type} at (${pos.x}, ${pos.y}, ${pos.z})`);

    const entityTypeMappings = [
        { types: currentConfig.entityTypes?.minecarts, permission: PERMISSIONS.ATTACK_MINECART, name: "矿车" },
        { check: (e) => e.isPlayer(), permission: PERMISSIONS.ATTACK_PLAYER, name: "玩家" },
        { types: currentConfig.entityTypes?.animals, permission: PERMISSIONS.ATTACK_ANIMAL, name: "动物" },
        { types: currentConfig.entityTypes?.monsters, permission: PERMISSIONS.ATTACK_MONSTER, name: "怪物" },
    ];

    let specificPermissionId = null;
    let specificPermissionName = "";

    for (const mapping of entityTypeMappings) {
        if (mapping.check && mapping.check(targetEntity)) {
            specificPermissionId = mapping.permission.id;
            specificPermissionName = mapping.name;
            break;
        }
        if (mapping.types && matchesIdPattern(targetEntity.type, mapping.types)) {
            specificPermissionId = mapping.permission.id;
            specificPermissionName = mapping.name;
            break;
        }
    }

    // 优先检查特定权限
    if (specificPermissionId) {
        logDebug(`检测到特定实体类型 ${specificPermissionName}，检查权限 ${specificPermissionId}`);
        if (checkPriorityPermission(player, pos, specificPermissionId, areaData, spatialIndex)) {
            logDebug(`特定权限 ${specificPermissionId} 检查通过`);
            return true; // 有特定权限，允许
        }
        logDebug(`特定权限 ${specificPermissionId} 检查失败，继续检查通用权限 ${PERMISSIONS.ATTACK_ENTITY.id}`);
        // 特定权限失败，继续检查通用权限，如果通用权限也没有，则拒绝并提示（如果需要）
        const hasGeneralPermission = checkPriorityPermission(player, pos, PERMISSIONS.ATTACK_ENTITY.id, areaData, spatialIndex);
        logDebug(`通用攻击权限 ${PERMISSIONS.ATTACK_ENTITY.id} 检查结果: ${hasGeneralPermission}`);
        if (!hasGeneralPermission) {
            const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
            if (areasAtPos.length > 0) {
                // 根据特定类型提示，因为用户尝试攻击的是特定类型
                player.tell(`§c你没有权限在此区域攻击${specificPermissionName}！`);
                return false; // 特定和通用权限都没有
            }
        }
        return hasGeneralPermission; // 返回通用权限的结果
    }

    // 如果不是特定类型，检查通用攻击权限
    logDebug(`未匹配特定实体类型，检查通用攻击权限 ${PERMISSIONS.ATTACK_ENTITY.id}`);
    const hasGeneralPermission = checkPriorityPermission(player, pos, PERMISSIONS.ATTACK_ENTITY.id, areaData, spatialIndex);
    logDebug(`通用攻击权限 ${PERMISSIONS.ATTACK_ENTITY.id} 检查结果: ${hasGeneralPermission}`);
    if (!hasGeneralPermission) {
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            // player.tell("§c你没有权限在此区域攻击实体！"); // 通用攻击失败通常不提示
            return false;
        }
    }
    return hasGeneralPermission;
}

// --- 映射表 ---

const containerPermissionMap = {
    "minecraft:chest": PERMISSIONS.OPEN_CONTAINER.id,
    "minecraft:trapped_chest": PERMISSIONS.OPEN_TRAPPEDCHEST.id,
    "minecraft:ender_chest": PERMISSIONS.OPEN_ENDERCHEST.id,
    "minecraft:crafting_table": PERMISSIONS.OPEN_CRAFTING.id,
    "minecraft:enchanting_table": PERMISSIONS.OPEN_ENCHANTING.id,
    "minecraft:hopper": PERMISSIONS.OPEN_HOPPER.id,
    "minecraft:dispenser": PERMISSIONS.OPEN_DISPENSER.id, // 已修正
    "minecraft:dropper": PERMISSIONS.OPEN_DROPPER.id,   // 已修正
    "minecraft:barrel": PERMISSIONS.OPEN_BARREL.id,
    "minecraft:furnace": PERMISSIONS.OPEN_FURNACE.id,
    "minecraft:blast_furnace": PERMISSIONS.OPEN_BLAST_FURNACE.id,
    "minecraft:smoker": PERMISSIONS.OPEN_SMOKER.id,
    "minecraft:cartography_table": PERMISSIONS.OPEN_CARTOGRAPHY.id,
    "minecraft:stonecutter": PERMISSIONS.OPEN_STONECUTTER.id,
    "minecraft:brewing_stand": PERMISSIONS.OPEN_BREWING_STAND.id,
    "minecraft:crafter": PERMISSIONS.OPEN_CRAFTER.id,
    "minecraft:beacon": PERMISSIONS.OPEN_BEACON.id,
    "minecraft:grindstone": PERMISSIONS.OPEN_GRINDSTONE.id,
    // 可以继续添加其他容器类型
};

// 使用函数确保每次都获取最新的 config
const getItemUsePermissionMap = () => {
    const currentConfig = loadConfig();
    return [
        { types: currentConfig.itemTypes?.bow, permission: PERMISSIONS.USE_BOW, message: "§c你没有权限在此区域使用弓！" },
        { types: currentConfig.itemTypes?.crossbow, permission: PERMISSIONS.USE_CROSSBOW, message: "§c你没有权限在此区域使用弩！" },
        { types: currentConfig.itemTypes?.trident, permission: PERMISSIONS.USE_TRIDENT, message: "§c你没有权限在此区域使用三叉戟！" },
        { types: currentConfig.itemTypes?.potion, permission: PERMISSIONS.USE_POTION, message: "§c你没有权限在此区域使用药水！" },
        { types: currentConfig.itemTypes?.splashPotion, permission: PERMISSIONS.USE_SPLASH_POTION, message: "§c你没有权限在此区域使用喷溅药水！" },
        { types: currentConfig.itemTypes?.lingeringPotion, permission: PERMISSIONS.USE_LINGERING_POTION, message: "§c你没有权限在此区域使用滞留药水！" },
        { types: currentConfig.itemTypes?.expBottle, permission: PERMISSIONS.USE_EXP_BOTTLE, message: "§c你没有权限在此区域使用附魔之瓶！" },
        { types: currentConfig.itemTypes?.fishingRod, permission: PERMISSIONS.USE_FISHING_ROD, message: "§c你没有权限在此区域使用钓鱼竿！" },
        { types: currentConfig.itemTypes?.bucket, permission: PERMISSIONS.USE_BUCKET, message: "§c你没有权限在此区域使用桶！" },
    ];
};

const getItemOnBlockPermissionMap = () => {
    const currentConfig = loadConfig();
    return [
        // 方块交互优先
        { blockTypes: currentConfig.blockTypes?.daylightDetector, permission: PERMISSIONS.USE_DAYLIGHT_DETECTOR, message: "§c你没有权限操作这个阳光探测器！" },
        { blockTypes: currentConfig.blockTypes?.cauldron, permission: PERMISSIONS.USE_CAULDRON, message: "§c你没有权限操作这个炼药锅！" },
        { blockTypes: currentConfig.blockTypes?.comparator, permission: PERMISSIONS.USE_COMPARATOR, message: "§c你没有权限操作这个红石比较器！" },
        { blockTypes: currentConfig.blockTypes?.repeater, permission: PERMISSIONS.USE_REPEATER, message: "§c你没有权限操作这个红石中继器！" },
        { blockTypes: currentConfig.blockTypes?.noteblock, permission: PERMISSIONS.USE_NOTEBLOCK, message: "§c你没有权限操作这个音符盒！" },
        { blockTypes: currentConfig.blockTypes?.jukebox, permission: PERMISSIONS.USE_JUKEBOX, message: "§c你没有权限操作这个唱片机！" },
        { blockTypes: currentConfig.blockTypes?.button, permission: PERMISSIONS.USE_BUTTON, message: "§c你没有权限操作这个按钮！" },
        { blockTypes: currentConfig.blockTypes?.lever, permission: PERMISSIONS.USE_LEVER, message: "§c你没有权限操作这个拉杆！" },
        { blockTypes: currentConfig.blockTypes?.composter, permission: PERMISSIONS.USE_COMPOSTER, message: "§c你没有权限操作这个堆肥桶！" },
        { blockTypes: currentConfig.blockTypes?.door, permission: PERMISSIONS.USE_DOOR, message: "§c你没有权限操作这个门！" },
        { blockTypes: currentConfig.blockTypes?.trapdoor, permission: PERMISSIONS.USE_TRAPDOOR, message: "§c你没有权限操作这个活板门！" },
        { blockTypes: currentConfig.blockTypes?.fenceGate, permission: PERMISSIONS.USE_FENCE_GATE, message: "§c你没有权限操作这个栅栏门！" },
        { blockTypes: currentConfig.blockTypes?.campfire, permission: PERMISSIONS.USE_CAMPFIRE, message: "§c你没有权限操作这个营火！" },
        { blockTypes: currentConfig.blockTypes?.beehive, permission: PERMISSIONS.USE_BEEHIVE, message: "§c你没有权限操作这个蜂巢/蜂箱！" },
        { blockTypes: currentConfig.blockTypes?.bookshelf, permission: PERMISSIONS.USE_BOOKSHELF, message: "§c你没有权限操作这个雕纹书架！" },
        { blockTypes: currentConfig.blockTypes?.suspiciousBlock, permission: PERMISSIONS.USE_SUSPICIOUS_BLOCK, message: "§c你没有权限操作这个可疑方块！" },
        { blockTypes: currentConfig.blockTypes?.respawnAnchor, permission: PERMISSIONS.USE_RESPAWN_ANCHOR, message: "§c你没有权限操作这个重生锚！" },
        { blockTypes: currentConfig.blockTypes?.candle, permission: PERMISSIONS.USE_CANDLE, message: "§c你没有权限操作这个蜡烛！" },
        { blockTypes: currentConfig.blockTypes?.sign, permission: PERMISSIONS.USE_SIGN, message: "§c你没有权限操作这个告示牌！" },
        { blockTypes: currentConfig.blockTypes?.dragonEgg, permission: PERMISSIONS.INTERACT_DRAGON_EGG, message: "§c你没有权限操作这个龙蛋！" },
        // 物品与方块交互
        { itemTypes: currentConfig.itemTypes?.shovel, blockTypes: currentConfig.blockTypes?.shovelable, permission: PERMISSIONS.USE_SHOVEL, message: "§c你没有权限在此区域使用铲子！" },
        { itemTypes: currentConfig.itemTypes?.axe, blockTypes: currentConfig.blockTypes?.axeable, permission: PERMISSIONS.USE_AXE, message: "§c你没有权限在此区域使用斧头！" },
        { itemTypes: currentConfig.itemTypes?.hoe, blockTypes: currentConfig.blockTypes?.hoeable, permission: PERMISSIONS.USE_HOE, message: "§c你没有权限在此区域使用锄头！" },
    ];
};


// --- 事件监听器 ---

mc.listen("onDestroyBlock", (player, block) => {
    return handlePermissionCheck(player, block.pos, PERMISSIONS.BREAK.id, "破坏方块", "§c你没有权限在此区域破坏方块！");
});

mc.listen("onPlaceBlock", (player, block) => {
    return handlePermissionCheck(player, block.pos, PERMISSIONS.PLACE.id, "放置方块", "§c你没有权限在此区域放置方块！");
});

mc.listen("onOpenContainer", (player, block) => {
    const pos = block.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex();
    const currentConfig = loadConfig(); // 获取最新配置

    // 不在区域内直接允许
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length === 0) {
        return true;
    }
    logDebug(`玩家 ${player.name} 尝试打开容器 ${block.type} at (${pos.x}, ${pos.y}, ${pos.z})`);

    let permissionId = null;

    // 优先检查特殊类型（潜影盒、铁砧）
    if (currentConfig.shulkerBoxTypes && matchesIdPattern(block.type, currentConfig.shulkerBoxTypes)) {
        permissionId = PERMISSIONS.OPEN_SHULKER.id;
        logDebug("检测到潜影盒");
    } else if (currentConfig.anvilTypes && matchesIdPattern(block.type, currentConfig.anvilTypes)) {
        permissionId = PERMISSIONS.OPEN_ANVIL.id;
        logDebug("检测到铁砧");
    } else {
        // 检查普通容器映射表
        permissionId = containerPermissionMap[block.type];
        if (permissionId) {
            logDebug(`检测到容器 ${block.type}`);
        } else {
            // 未在映射表中找到，使用通用容器权限
            permissionId = PERMISSIONS.OPEN_OTHER_CONTAINER.id;
            logDebug(`未匹配特定容器，使用通用权限 ${permissionId}`);
        }
    }

    if (permissionId) {
        return handlePermissionCheck(player, pos, permissionId, `打开容器 ${block.type}`, "§c你没有权限操作这个容器！");
    }

    logWarning(`无法确定 ${block.type} 的容器权限ID，默认允许`);
    return true; // 如果连通用权限ID都没有（理论上不应发生），则默认允许
});

mc.listen("onTakeItem", (player, item) => {
    // 拾取物品通常不需要提示
    return handlePermissionCheck(player, item.pos, PERMISSIONS.PICKUP_ITEMS.id, "拾取物品");
});

// 监听丢弃物品事件 (ila)
/*
iListenAttentively.emplaceListener(
    "ila::mc::world::actor::player::PlayerDropItemAfterEvent",
    event => {
        const player = iListenAttentively.getPlayer(event["self"]);
        if (!player) return; // 防御性编程

        const result = handlePermissionCheck(player, player.pos, PERMISSIONS.DROP_ITEMS.id, "丢弃物品", "§c你没有权限在此区域丢弃物品！");
        if (!result) {
            event["cancelled"] = true; // 拦截
        }
    },
    iListenAttentively.EventPriority.High
);
*/

// 监听物品丢弃 (LLSE API - 如果需要的话)
/*
mc.listen("onDropItem", (player, item) => {
    return handlePermissionCheck(player, player.pos, PERMISSIONS.DROP_ITEMS.id, "丢弃物品", "§c你没有权限在此区域丢弃物品！");
});
*/

mc.listen("onStepOnPressurePlate", (entity, pressurePlate) => {
    if (!entity.isPlayer()) return true; // 只处理玩家
    const player = entity.toPlayer();
    return handlePermissionCheck(player, pressurePlate.pos, PERMISSIONS.USE_PRESSURE_PLATE.id, "使用压力板", "§c你没有权限在此区域使用压力板！");
});

mc.listen("onRide", (entity1, entity2) => {
    if (!entity1.isPlayer()) return true; // 只处理玩家骑乘者
    const player = entity1.toPlayer();
    const pos = entity2.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex();
    const currentConfig = loadConfig(); // 获取最新配置

    logDebug(`玩家 ${player.name} 尝试骑乘实体 ${entity2.type} at (${pos.x}, ${pos.y}, ${pos.z})`);

    const rideMappings = [
        { types: currentConfig.entityTypes?.boats, permission: PERMISSIONS.RIDE_BOAT, name: "船", message: "§c你没有权限在此区域乘坐船！" },
        { types: currentConfig.entityTypes?.minecarts, permission: PERMISSIONS.RIDE_MINECART, name: "矿车", message: "§c你没有权限在此区域乘坐矿车！" },
        { types: currentConfig.entityTypes?.horses, permission: PERMISSIONS.RIDE_HORSE, name: "马类坐骑", message: "§c你没有权限在此区域骑马！" },
        // 可以添加其他可骑乘实体类型
    ];

    let specificPermissionId = null;
    let specificDenialMessage = null;

    for (const mapping of rideMappings) {
        if (mapping.types && matchesIdPattern(entity2.type, mapping.types)) {
            specificPermissionId = mapping.permission.id;
            specificDenialMessage = mapping.message;
            logDebug(`检测到特定可骑乘实体 ${mapping.name}，检查权限 ${specificPermissionId}`);
            break;
        }
    }

    // 优先处理特定类型
    if (specificPermissionId) {
        const hasSpecificPerm = checkPriorityPermission(player, pos, specificPermissionId, areaData, spatialIndex);
        logDebug(`特定骑乘权限 ${specificPermissionId} 检查结果: ${hasSpecificPerm}`);

        if (!hasSpecificPerm) {
            // 如果特定权限被拒绝，则直接拒绝，并提示特定信息
            logDebug(`特定骑乘权限 ${specificPermissionId} 被拒绝，操作不允许`);
            const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
            if (areasAtPos.length > 0) {
                 player.tell(specificDenialMessage || "§c你没有权限在此区域骑乘此实体！");
            }
            return false;
        } else {
             // 如果特定权限允许，则直接允许
             logDebug(`特定骑乘权限 ${specificPermissionId} 允许，操作允许`);
             return true;
        }
        // 注意：这里不再回退检查通用权限。特定权限的设置（允许或拒绝）具有最高优先级。
        // 如果特定权限没有显式设置，checkPriorityPermission 会根据继承规则返回结果，
        // 如果继承结果是允许，就在上面返回 true 了。如果继承结果是拒绝，就在上面返回 false 了。
        // 只有完全不匹配特定类型时，才检查通用权限。
    }

    // 如果不匹配特定类型，检查通用骑乘权限
    logDebug(`未匹配特定可骑乘实体，检查通用骑乘权限 ${PERMISSIONS.RIDE_ENTITY.id}`);
    const hasGeneralRidePermission = checkPriorityPermission(player, pos, PERMISSIONS.RIDE_ENTITY.id, areaData, spatialIndex);
    logDebug(`通用骑乘权限 ${PERMISSIONS.RIDE_ENTITY.id} 检查结果: ${hasGeneralRidePermission}`);
    if (!hasGeneralRidePermission) {
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
        if (areasAtPos.length > 0) {
            player.tell("§c你没有权限在此区域骑乘此实体！"); // 通用失败提示
            return false;
        }
    }
    return hasGeneralRidePermission;
});

mc.listen("onChangeArmorStand", (armorStand, player, slot) => {
    return handlePermissionCheck(player, armorStand.pos, PERMISSIONS.ARMOR_STAND.id, "操作盔甲架", "§c你没有权限在此区域操作盔甲架！");
});

mc.listen("onAttackEntity", (player, entity) => {
    return handleAttackPermission(player, entity);
});

mc.listen("onMobHurt", (mob, source, damage, cause) => {
    if (!source || !source.isPlayer()) return true; // 只处理玩家造成的伤害
    const player = source.toPlayer();
    // 注意：这里复用 handleAttackPermission，它内部会检查权限并可能发送消息
    // onMobHurt 通常不需要单独发送 "你没有权限攻击" 的消息，因为 onAttackEntity 可能已经发送了
    // 但我们需要阻止伤害，所以返回 handleAttackPermission 的结果
    return handleAttackPermission(player, mob);
});

mc.listen("onAttackBlock", (player, block, item) => {
    const pos = block.pos;
    const currentConfig = loadConfig(); // 获取最新配置

    // 优先检查龙蛋交互
    if (currentConfig.blockTypes?.dragonEgg && matchesIdPattern(block.type, currentConfig.blockTypes.dragonEgg)) {
        logDebug("检测到攻击龙蛋");
        return handlePermissionCheck(player, pos, PERMISSIONS.INTERACT_DRAGON_EGG.id, "攻击龙蛋", "§c你没有权限操作这个龙蛋！");
    }

    // 检查通用攻击方块权限 (攻击失败通常不提示)
    return handlePermissionCheck(player, pos, PERMISSIONS.ATTACK_BLOCK.id, "攻击方块");
});

mc.listen("onUseItem", (player, item) => {
    const pos = player.pos; // 使用玩家位置
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex();
    const itemUseMap = getItemUsePermissionMap(); // 获取最新的映射

    // 不在区域内直接允许
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length === 0) {
        return true;
    }
    logDebug(`玩家 ${player.name} 尝试使用物品 ${item.type} at (${pos.x}, ${pos.y}, ${pos.z})`);

    // 检查特殊物品
    for (const mapping of itemUseMap) {
        if (mapping.types && matchesIdPattern(item.type, mapping.types)) {
            logDebug(`检测到使用特殊物品 ${item.type}，检查权限 ${mapping.permission.id}`);
            return handlePermissionCheck(player, pos, mapping.permission.id, `使用物品 ${item.type}`, mapping.message);
        }
    }

    // 如果不是特殊物品，检查通用使用物品权限
    logDebug(`未匹配特殊物品，检查通用权限 ${PERMISSIONS.USE_ITEM.id}`);
    return handlePermissionCheck(player, pos, PERMISSIONS.USE_ITEM.id, "使用物品", "§c你没有权限在此区域使用物品！");
});

mc.listen("onUseItemOn", (player, item, block, side, pos) => {
    const blockPos = block.pos; // 使用方块位置
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex();
    const itemOnBlockMap = getItemOnBlockPermissionMap(); // 获取最新的映射
    const currentConfig = loadConfig(); // 获取最新配置

    // 不在区域内直接允许
    const areasAtPos = getPriorityAreasAtPosition(blockPos, areaData, spatialIndex);
    if (areasAtPos.length === 0) {
        return true;
    }
    logDebug(`玩家 ${player.name} 尝试对方块 ${block.type} 使用物品 ${item.type} at (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`);

    //检查放置矿车
    if (currentConfig.itemTypes?.minecarts && matchesIdPattern(item.type, currentConfig.itemTypes.minecarts) &&
        currentConfig.blockTypes?.rails && matchesIdPattern(block.type, currentConfig.blockTypes.rails)) {
        logDebug(`检测到放置矿车，检查权限 ${PERMISSIONS.PLACE_MINECART.id}`);
        return handlePermissionCheck(player, blockPos, PERMISSIONS.PLACE_MINECART.id, "放置矿车", "§c你没有权限在此区域放置矿车！");
    }


    // 检查特殊交互 (物品+方块 或 仅方块) - 原有逻辑
    for (const mapping of itemOnBlockMap) {
        const blockMatch = mapping.blockTypes && matchesIdPattern(block.type, mapping.blockTypes);
        // 如果 itemTypes 未定义，则只匹配方块；否则需要物品和方块都匹配
        const itemMatch = !mapping.itemTypes || matchesIdPattern(item.type, mapping.itemTypes);

        if (blockMatch && itemMatch) {
             logDebug(`检测到特殊交互: item ${item.type} on block ${block.type}，检查权限 ${mapping.permission.id}`);
             return handlePermissionCheck(player, blockPos, mapping.permission.id, `对方块 ${block.type} 使用物品 ${item.type}`, mapping.message);
        }
    }

    // 如果不是特殊交互，检查通用对方块使用物品权限
    logDebug(`未匹配特殊交互，检查通用权限 ${PERMISSIONS.USE_ITEM_ON_BLOCK.id}`);
    return handlePermissionCheck(player, blockPos, PERMISSIONS.USE_ITEM_ON_BLOCK.id, `对方块 ${block.type} 使用物品`, "§c你没有权限在此区域对方块使用物品！");
});

mc.listen("onBedEnter", (player, pos) => {
    return handlePermissionCheck(player, pos, PERMISSIONS.USE_BED.id, "使用床", "§c你没有权限在此区域使用床！");
});

mc.listen("onPlayerPullFishingHook", (player, entity, item) => {
    // 权限检查基于被钓起实体的位置
    return handlePermissionCheck(player, entity.pos, PERMISSIONS.USE_FISHING_ROD.id, "使用钓鱼竿钓起实体", "§c你没有权限在此区域使用钓鱼竿！");
});

mc.listen("onPlayerInteractEntity", (player, entity) => { // 移除 pos 参数，使用 entity.pos
    const pos = entity.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex();
    const currentConfig = loadConfig(); // 获取最新配置

    logDebug(`玩家 ${player.name} 尝试与实体 ${entity.type} 交互 at (${pos.x}, ${pos.y}, ${pos.z})`);

    const interactMappings = [
        { types: currentConfig.entityTypes?.villagers, permission: PERMISSIONS.INTERACT_VILLAGER, name: "村民", message: "§c你没有权限在此区域与村民交互！" },
        { types: currentConfig.entityTypes?.chestBoats, permission: PERMISSIONS.INTERACT_CHEST_BOAT, name: "船箱", message: "§c你没有权限在此区域与船箱交互！" },
        { types: currentConfig.entityTypes?.chestMinecarts, permission: PERMISSIONS.INTERACT_CHEST_MINECART, name: "矿车箱子", message: "§c你没有权限在此区域与矿车箱子交互！" },
        // 可以添加其他可交互实体类型
    ];

    let specificPermissionId = null;
    let specificDenialMessage = null;

    for (const mapping of interactMappings) {
        if (mapping.types && matchesIdPattern(entity.type, mapping.types)) {
            specificPermissionId = mapping.permission.id;
            specificDenialMessage = mapping.message;
            logDebug(`检测到特定可交互实体 ${mapping.name}，检查权限 ${specificPermissionId}`);
            break;
        }
    }

    // 优先处理特定类型
    if (specificPermissionId) {
        const hasSpecificPerm = checkPriorityPermission(player, pos, specificPermissionId, areaData, spatialIndex);
        logDebug(`特定交互权限 ${specificPermissionId} 检查结果: ${hasSpecificPerm}`);

        if (!hasSpecificPerm) {
            // 如果特定权限被拒绝，则直接拒绝，并提示特定信息
            logDebug(`特定交互权限 ${specificPermissionId} 被拒绝，操作不允许`);
            const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
            if (areasAtPos.length > 0) {
                 player.tell(specificDenialMessage || "§c你没有权限在此区域与此实体交互！");
            }
            return false;
        } else {
             // 如果特定权限允许，则直接允许
             logDebug(`特定交互权限 ${specificPermissionId} 允许，操作允许`);
             return true;
        }
        // 理由同上：特定权限设置优先，不再回退检查通用权限。
    }

    // 如果不匹配特定类型，检查通用交互权限
    logDebug(`未匹配特定可交互实体，检查通用交互权限 ${PERMISSIONS.INTERACT_ENTITY.id}`);
    // 交互实体通常不提示通用失败
    const hasGeneralInteractPermission = checkPriorityPermission(player, pos, PERMISSIONS.INTERACT_ENTITY.id, areaData, spatialIndex);
     logDebug(`通用交互权限 ${PERMISSIONS.INTERACT_ENTITY.id} 检查结果: ${hasGeneralInteractPermission}`);
     if (!hasGeneralInteractPermission) {
         // 虽然通常不提示，但还是要返回 false 来阻止交互
         return false;
     }
     return true;
});


mc.listen("onUseFrameBlock", (player, block) => {
    // 操作展示框通常不提示失败
    return handlePermissionCheck(player, block.pos, PERMISSIONS.ITEM_FRAME.id, "操作展示框");
});

iListenAttentively.emplaceListener(
    "ila::mc::world::actor::player::PlayerEditSignBeforeEvent",
    event => {
        const player = iListenAttentively.getPlayer(event["self"]); // 使用 getPlayer 获取 Player 对象
        if (!player) {
            logWarning("PlayerEditSignBeforeEvent: 无法获取玩家对象");
            event["cancelled"] = true; // 获取不到玩家则阻止
            return;
        }

        const signPosArray = event["pos"];
        if (!signPosArray || signPosArray.length < 3) {
            logWarning(`PlayerEditSignBeforeEvent: 无效的告示牌位置 for player ${player.name}`);
            event["cancelled"] = true; // 位置无效则阻止
            return;
        }

        // 构建位置对象，使用玩家当前的维度ID（假设编辑时玩家和告示牌在同一维度）
        const pos = {
            x: signPosArray[0],
            y: signPosArray[1],
            z: signPosArray[2],
            dimid: player.pos.dimid // 使用玩家维度
        };

        logDebug(`玩家 ${player.name} 尝试编辑告示牌 at (${pos.x}, ${pos.y}, ${pos.z})`);

        // 调用权限检查函数
        const hasPermission = handlePermissionCheck(
            player,
            pos,
            PERMISSIONS.USE_SIGN.id, // 使用 USE_SIGN 权限
            "编辑告示牌",
            "§c你没有权限在此区域编辑告示牌！" // 权限不足提示
        );

        if (!hasPermission) {
            logDebug(`玩家 ${player.name} 编辑告示牌权限不足，操作被阻止`);
            event["cancelled"] = true; // 权限不足，拦截事件
        } else {
            logDebug(`玩家 ${player.name} 允许编辑告示牌`);
            // 权限足够，不需要设置 event["cancelled"] = false，默认不拦截
        }
    },
    iListenAttentively.EventPriority.High // 保持高优先级以确保先执行权限检查
);

iListenAttentively.emplaceListener(
    "ila::mc::world::actor::MobHurtEffectBeforeEvent",
    event => {
                if (!event["source"]) {
                    logDebug("药水伤害事件缺少来源信息，允许事件继续。");
                    return; // 如果没有来源信息，默认允许
                }
        
        const targetEntity = iListenAttentively.getActor(event["self"]); 
        const sourceActor = iListenAttentively.getActor(event["source"]); 

        if (!sourceActor || !sourceActor.isPlayer()) {
            return; 
        }

        const player = sourceActor.toPlayer(); 

        if (!targetEntity) {
            logWarning(`MobHurtEffectBeforeEvent: 无法获取目标实体 for player ${player.name}`);
            event["cancelled"] = true; 
            return;
        }

        const pos = targetEntity.pos; 

        // 检查位置是否有效
        if (!pos || pos.x === undefined || pos.y === undefined || pos.z === undefined || pos.dimid === undefined) {
            logWarning(`MobHurtEffectBeforeEvent: 目标实体位置无效 for player ${player.name}`);
            event["cancelled"] = true; 
            return;
        }

        logDebug(`玩家 ${player.name} 尝试对实体 ${targetEntity.type} (${targetEntity.uniqueId}) 造成魔法伤害 at (${pos.x}, ${pos.y}, ${pos.z})，检查攻击权限`);

        // 复用 handleAttackPermission 函数检查权限
        const hasPermission = handleAttackPermission(player, targetEntity);

        if (!hasPermission) {
            logDebug(`玩家 ${player.name} 对实体 ${targetEntity.type} 的魔法伤害权限不足，操作被阻止`);
            event["cancelled"] = true; // 权限不足，拦截事件 (阻止魔法伤害)
            // 注意：handleAttackPermission 内部可能会发送提示消息，这里不再重复发送
        } else {
            logDebug(`玩家 ${player.name} 允许对实体 ${targetEntity.type} 造成魔法伤害`);
            // 权限足够，不需要设置 event["cancelled"] = false，默认不拦截
        }
    },
    iListenAttentively.EventPriority.Highest // 使用最高优先级确保在其他效果前检查
);
/**
 * 跟踪玩家位置并处理区域进入权限
 * @param {Player} player - 要检查的玩家
 */
function handlePlayerMovement(player) {
    const currentPos = player.pos;
    if (!currentPos || currentPos.x === undefined || currentPos.y === undefined || currentPos.z === undefined || currentPos.dimid === undefined) {
        //logDebug(`玩家 ${player.name} 位置无效或不完整，跳过移动检查`);
        return; // 增加更严格的位置有效性检查
    }

    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex();

    const playerUUID = player.uuid; // 缓存UUID

    // 如果玩家之前没有记录位置或初次进入，将位置存储在历史记录中
    if (!playerPositionHistory[playerUUID] || playerPositionHistory[playerUUID].length === 0) {
        //logDebug(`首次跟踪玩家 ${player.name} 位置`);
        updatePositionHistory(playerUUID, currentPos); // 初始化时也更新历史
        return; // 首次位置跟踪，允许
    }

    const areasAtCurrentPos = getPriorityAreasAtPosition(currentPos, areaData, spatialIndex);
    const currentPriorityArea = areasAtCurrentPos.length > 0 ? areasAtCurrentPos[0] : null;
    const currentPriorityAreaId = currentPriorityArea ? currentPriorityArea.id : null;

    // 获取之前的位置
    const prevPositions = playerPositionHistory[playerUUID];
    // 确保 prevPositions 和最后一个元素存在
    const prevPos = prevPositions.length > 0 ? prevPositions[prevPositions.length - 1] : null;

    if (!prevPos) {
        logWarning(`玩家 ${player.name} 缺少先前位置历史，无法检查区域进入`);
        updatePositionHistory(playerUUID, currentPos); // 记录当前位置以备下次使用
        return;
    }

    // 获取先前位置的最高优先级区域
    const prevAreasAtPos = getPriorityAreasAtPosition(prevPos, areaData, spatialIndex);
    const prevPriorityArea = prevAreasAtPos.length > 0 ? prevAreasAtPos[0] : null;
    const prevPriorityAreaId = prevPriorityArea ? prevPriorityArea.id : null;

    // 核心逻辑：检查最高优先级区域是否发生变化
    if (currentPriorityAreaId !== prevPriorityAreaId) {
        // 最高优先级区域已改变 (进入新区域或离开区域)

        if (currentPriorityArea) {
            // 进入了一个新的最高优先级区域
            //logDebug(`玩家 ${player.name} 尝试进入新的最高优先级区域 ${currentPriorityArea.area.name} (ID: ${currentPriorityAreaId})，先前区域ID: ${prevPriorityAreaId}`);

            // 检查进入权限
            if (!checkPriorityPermission(player, currentPos, PERMISSIONS.ENTER_AREA.id, areaData, spatialIndex)) {
                // 权限被拒绝 - 传送回最后的有效位置
                const safePos = getSafePosition(playerUUID);
                if (safePos) {
                    logInfo(`玩家 ${player.name} 没有权限进入区域 ${currentPriorityArea.area.name}，传送回 (${safePos.x.toFixed(1)}, ${safePos.y.toFixed(1)}, ${safePos.z.toFixed(1)})`);
                    player.tell("§c你没有权限进入此区域！");

                    // 尝试传送
                    const success = player.teleport(safePos.x, safePos.y, safePos.z, safePos.dimid);
                    if (!success) {
                        logWarning(`传送玩家 ${player.name} 到安全位置失败！`);
                    }

                    return;
                } else {
                    logWarning(`玩家 ${player.name} 没有进入区域 ${currentPriorityArea.area.name} 的权限，但找不到安全传送位置！`);
                    // 无法传送，但仍阻止其进入逻辑（不更新历史到新位置）
                    // 尝试传送到区域边界外
                    logWarning(`玩家 ${player.name} 没有进入区域 ${currentPriorityArea.area.name} 的权限，且找不到历史安全位置。尝试传送到区域边界外...`);
                    const boundaryPos = findNearestBoundaryPoint(currentPos, currentPriorityArea.area);
                    if (boundaryPos) {
                        logInfo(`将玩家 ${player.name} 传送到区域 ${currentPriorityArea.area.name} 的最近边界点 (${boundaryPos.x.toFixed(1)}, ${boundaryPos.y.toFixed(1)}, ${boundaryPos.z.toFixed(1)})`);
                        const successBoundary = player.teleport(boundaryPos.x, boundaryPos.y, boundaryPos.z, boundaryPos.dimid);
                        if (!successBoundary) {
                            logError(`传送玩家 ${player.name} 到边界位置失败！`);
                        }
                    } else {
                        logError(`无法计算玩家 ${player.name} 到区域 ${currentPriorityArea.area.name} 的边界传送点！玩家可能被卡住。`);
                    }
                    return; // 无论传送是否成功，都阻止进入并返回
                }
            } else {
                //logDebug(`玩家 ${player.name} 权限检查通过，允许进入区域 ${currentPriorityArea.area.name}`);
                // 权限允许，继续执行下面的历史更新
            }
        } else {
            // 离开了所有区域 (currentPriorityAreaId is null, prevPriorityAreaId was not)
            //logDebug(`玩家 ${player.name} 已离开区域 ${prevPriorityArea.area.name} (ID: ${prevPriorityAreaId}) 进入野外`);
            // 无需权限检查，继续执行下面的历史更新
        }
    } else {
         // logDebug(`玩家 ${player.name} 仍在同一最高优先级区域 ${currentPriorityAreaId ? currentPriorityArea.area.name : '野外'}`);
         // 仍在同一区域或都在区域外，无需特殊处理，只需更新历史
    }

    // 权限允许 或 仍在同一区域 或 离开区域进入野外 -> 更新位置历史
    updatePositionHistory(playerUUID, currentPos);
}

/**
 * 更新玩家的位置历史
 * @param {string} uuid - 玩家uuid
 * @param {object} pos - 要添加到历史的位置
 */
function updatePositionHistory(uuid, pos) {
    // 复制位置对象以避免引用问题
    const posCopy = {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        dimid: pos.dimid
    };
    
    // 如果需要则初始化
    if (!playerPositionHistory[uuid]) {
        playerPositionHistory[uuid] = [];
    }
    
    // 添加新位置
    playerPositionHistory[uuid].push(posCopy);
    
    // 只保留最后5个位置以避免内存膨胀
    if (playerPositionHistory[uuid].length > 5) {
        playerPositionHistory[uuid].shift();
    }
}

/**
 * 从玩家历史中获取安全位置
 * @param {string} uuid - 玩家uuid
 * @returns {object|null} 安全位置或如果没有找到则为null
 */
function getSafePosition(uuid) {
    if (!playerPositionHistory[uuid] || playerPositionHistory[uuid].length < 2) {
        return null; // 还没有历史记录
    }
    
    // 获取之前的安全位置(倒数第二个位置)
    // 这通常在受限区域之外
    return playerPositionHistory[uuid][playerPositionHistory[uuid].length - 2];
}

// 在玩家断开连接时添加数据清理
mc.listen("onLeft", (player) => {
    // 只清理本文件管理的 playerPositionHistory
    delete playerPositionHistory[player.uuid];
    logDebug(`Cleared position history for player ${player.name} (UUID: ${player.uuid}) on leave.`);
});


// 设置定时器定期检查玩家位置
setInterval(() => {
    const players = mc.getOnlinePlayers();
    players.forEach(player => {
        handlePlayerMovement(player);
    });
}, 500); // 比区域显示更频繁地检查，例如每500毫秒

// mc.listen("onBlockInteracted", ...) // 这个事件似乎与 onUseItemOn 重复，暂时注释掉
