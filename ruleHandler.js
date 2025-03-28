const { getAreaData, getSpatialIndex } = require('./czareaprotection');
const { getPriorityAreasAtPosition, checkAreasOverlap } = require('./utils');
const { worldToChunkCoords } = require('./spatialIndex');
const { logDebug } = require('./logger');
const iListenAttentively = require('../iListenAttentively-LseExport/lib/iListenAttentively.js');

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
        const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2) }; // 修正维度ID Nether=-1, End=1 -> 0, 1, 2

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
        const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2) }; // 修正维度ID

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
        const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2) }; // 修正维度ID

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

// 末影人拿起方块事件 (iListenAttentively)
iListenAttentively.emplaceListener(
    "ila::mc::world::actor::EndermanTakeBlockBeforeEvent",
    event => {
        let dim = event["dimid"];
        let x = event["pos"][0];
        let y = event["pos"][1];
        let z = event["pos"][2];
        const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2) }; // 修正维度ID

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
        const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2) }; // 修正维度ID

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
        const explosionPos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2) }; // 修正维度ID

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

// 液体流动事件 (iListenAttentively) - 保持原样，因为它检查两个位置的区域
/*
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

        const fromPos = { x: fromX, y: fromY, z: fromZ, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2) };
        const toPos = { x: toX, y: toY, z: toZ, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2) };

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

// 压力板事件 (只处理实体部分)
mc.listen("onStepOnPressurePlate", function(entity, pressurePlate) {
    // 如果是玩家，则由 eventHandler.js 处理权限
    if (entity.isPlayer()) {
        return true;
    }

    const pos = pressurePlate.pos;
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`检测到实体 ${entity.type} 踩压力板 at (${pos.x}, ${pos.y}, ${pos.z})`);

    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length > 0) {
        const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
        const area = areaInfo.area;
        const areaId = areaInfo.id;

        // 检查区域是否允许实体踩压力板
        logDebug(`实体 ${entity.type} 踩压力板，检查区域规则`);
        if(!area.rules || !area.rules.allowEntityPressurePlate) {
            logDebug(`区域 ${areaId} (${area.name}) 不允许实体踩压力板，已拦截`);
            return false;
        }
    }

    return true; // 不在区域内或规则允许
});

// 乘骑事件 (只处理实体部分)
mc.listen("onRide", function(entity1, entity2) {
    // 如果骑乘者是玩家，则由 eventHandler.js 处理权限
    if (entity1.isPlayer()) {
        return true;
    }

    const pos = entity2.pos; // 使用被骑乘实体的位置
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    logDebug(`检测到实体 ${entity1.type} 乘骑事件 at (${pos.x}, ${pos.y}, ${pos.z})`);

    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);
    if (areasAtPos.length > 0) {
        const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
        const area = areaInfo.area;
        const areaId = areaInfo.id;

        logDebug(`实体 ${entity1.type} 尝试骑乘，检查区域规则`);
        if(!area.rules || !area.rules.allowEntityRide) {
            logDebug(`区域 ${areaId} (${area.name}) 不允许生物乘骑，已拦截`);
            return false;
        }
    }

    return true; // 不在区域内或规则允许
});
