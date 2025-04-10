const { getAreaData, getSpatialIndex } = require('./czareaprotection');
const { getPriorityAreasAtPosition, checkAreasOverlap } = require('./utils');
const { worldToChunkCoords } = require('./spatialIndex');
const { logDebug, logError } = require('./logger'); // 确保引入 logError
const iListenAttentively = require('../iListenAttentively-LseExport/lib/iListenAttentively.js');
const { loadConfig } = require('./configManager'); // 引入配置加载
const config = loadConfig(); // 在文件顶部加载配置

// 监听实体爆炸事件 (检查规则)
if (config.ruleListenerControl.onEntityExplode) {
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

            if(isAllowed === false) { // Explicitly check for false
                logDebug(`区域 ${areaId} 不允许 ${entity.type} 类型的爆炸`);
                return false; // 阻止爆炸
            }
        }
        return true; // 不在区域内或区域允许 (isAllowed is true or undefined)
    });
}

// 监听方块爆炸事件 (检查规则)
if (config.ruleListenerControl.onBlockExplode) {
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
            if(area.rules?.allowBlockExplosion === false) { // Explicitly check for false
                logDebug(`区域 ${areaId} (${area.name}) 不允许方块爆炸，已拦截`);
                return false; // 拦截爆炸
            }
        }

        logDebug("未找到需要保护的区域或区域允许，允许爆炸");
        return true; // Not in area or rule allows (true or undefined)
    });
}

// 监听火焰蔓延事件 (检查规则)
if (config.ruleListenerControl.onFireSpread) {
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
            if(area.rules?.allowFireSpread === false) { // Explicitly check for false
                logDebug(`区域 ${areaId} 不允许火焰蔓延`);
                return false; // 阻止蔓延
            }
        }
        return true; // 不在区域内或区域允许
    });
}

// 火焰尝试燃烧方块事件 (iListenAttentively)
if (config.ruleListenerControl.fireTryBurnBlock) {
    try {
        iListenAttentively.emplaceListener(
            "ila::mc::world::FireTryBurnBlockBeforeEvent",
            event => {
                let dim = event["dimId"];
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
                    if(area.rules?.allowFireBurnBlock === false) { // Explicitly check for false
                        logDebug(`区域 ${areaId} (${area.name}) 不允许火焰烧毁方块，已拦截`);
                        event["cancelled"] = true;  // 拦截燃烧
                        return;
                    }
                }

                logDebug("允许火焰烧毁方块");
            },
            iListenAttentively.EventPriority.Normal
        );
    } catch (e) {
        logError(`Failed to register ila::mc::world::FireTryBurnBlockBeforeEvent listener: ${e.message}`);
    }
}

// 苔藓生长事件 (iListenAttentively)
if (config.ruleListenerControl.mossGrowth) {
    try {
        iListenAttentively.emplaceListener(
            "ila::mc::world::level::block::MossGrowthBeforeEvent",
            event => {
                let dim = event["dimId"];
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
                    if(area.rules?.allowMossGrowth === false) { // Explicitly check for false
                        logDebug(`区域 ${areaId} (${area.name}) 不允许苔藓生长，已拦截`);
                        event["cancelled"] = true;  // 拦截生长
                        return;
                    }
                }

                logDebug("允许苔藓生长");
            },
            iListenAttentively.EventPriority.Normal
        );
    } catch (e) {
        logError(`Failed to register ila::mc::world::level::block::MossGrowthBeforeEvent listener: ${e.message}`);
    }
}

// 幽匿催发体生成事件 (iListenAttentively)
if (config.ruleListenerControl.sculkSpread) {
    try {
        iListenAttentively.emplaceListener(
            "ila::mc::world::level::block::SculkSpreadBeforeEvent",
            event => {
                let dim = event["dimId"];
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
                    if(area.rules?.allowSculkSpread === false) { // Explicitly check for false
                        logDebug(`区域 ${areaId} (${area.name}) 不允许幽匿催发体生成，已拦截`);
                        event["cancelled"] = true;  // 拦截生成
                        return;
                    }
                }

                // logDebug("允许幽匿催发体生成");
            },
            iListenAttentively.EventPriority.Normal
        );
    } catch (e) {
        logError(`Failed to register ila::mc::world::level::block::SculkSpreadBeforeEvent listener: ${e.message}`);
    }
}

// 凋灵破坏方块事件 (优化：可以先用索引粗略判断，再精确检查重叠)
if (config.ruleListenerControl.onWitherBossDestroy) {
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
                if(area.rules?.allowWitherDestroy === false) { // Explicitly check for false
                    logDebug(`区域 ${areaId} (${area.name}) 不允许凋灵破坏方块，已拦截`);
                    return false; // 拦截破坏行为
                }
            }
        }

        return true; // 没有重叠或重叠区域允许
    });
}

// 生物自然生成事件
if (config.listenerControl.onMobTrySpawn) { // 用户请求 - 使用 listenerControl
    mc.listen("onMobTrySpawn", function(typeName, pos) {
        const areaData = getAreaData(); // 假设此函数返回您的区域定义
        const spatialIndex = getSpatialIndex(); // 假设此函数返回用于快速查找的空间索引

        // 假设此函数返回一个按优先级排序的区域信息数组（最高优先级在前）
        // 数组元素格式：{ area: object, id: string, priority: number }
        const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

        if (areasAtPos.length > 0) {
            const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
            const area = areaInfo.area;
            const areaId = areaInfo.id;
            const rules = area.rules || {}; // 获取规则，确保它是一个对象
            const exceptions = rules.mobSpawnExceptions || []; // 获取例外列表，确保它是一个数组
            const cleanTypeName = typeName.replace(/<>$/, ''); // 移除末尾的 <>

            //logDebug(`[区域: ${areaId}] 正在检查位于 (${pos.x}, ${pos.y}, ${pos.z}) 的 ${typeName} (清理后: ${cleanTypeName}) 生成。规则 allowMobNaturalSpawn: ${rules.allowMobNaturalSpawn}。例外: [${exceptions.join(', ')}]`);

            // 检查区域规则是否允许自然生物生成
            if (rules.allowMobNaturalSpawn === false) { // 显式检查 false
                // 规则禁止生成。检查此生物类型是否为例外。
                //logDebug(`[区域: ${areaId}] 规则已关闭。正在检查 ${cleanTypeName} 的例外情况...`);
                if (exceptions.includes(cleanTypeName)) { // 使用清理后的 typeName 进行检查
                    //logDebug(`[区域: ${areaId}] ${cleanTypeName} 在例外列表中。允许生成。`);
                    return true; // 是例外，因此允许生成。
                } else {
                    //logDebug(`[区域: ${areaId}] ${cleanTypeName} 不在例外列表中。阻止生成。`);
                    return false; // 不是例外，因此根据规则阻止生成。
                }
            } else { // 规则允许生成 (即 rules.allowMobNaturalSpawn 为 true 或 undefined/null)
                // 规则允许生成。检查此生物类型是否为反向例外（即应被阻止）。
                //logDebug(`[区域: ${areaId}] 规则已开启 (或未定义，默认为开启)。正在检查 ${cleanTypeName} 的例外情况...`);
                if (exceptions.includes(cleanTypeName)) { // 使用清理后的 typeName 进行检查
                    //logDebug(`[区域: ${areaId}] ${cleanTypeName} 在例外列表中。阻止生成 (反向例外)。`);
                    return false; // 是例外，因此即使规则通常允许，也要阻止生成。
                } else {
                    //logDebug(`[区域: ${areaId}] ${cleanTypeName} 不在例外列表中。允许生成。`);
                    return true; // 不是例外，因此根据规则允许生成 (默认行为)。
                }
            }
        } else {
            // 在此位置未找到相关区域。默认行为是允许生成。
            //logDebug(`检查位于 (${pos.x}, ${pos.y}, ${pos.z}) 的 ${typeName} 生成：未找到相关区域。允许生成。`);
            return true; // 如果没有区域规则适用，则显式允许生成
        }
    });
}

if (config.ruleListenerControl.dragonEggTeleport) {
    try {
        iListenAttentively.emplaceListener(
            "ila::mc::world::level::block::DragonEggBlockTeleportBeforeEvent",
            event => {
                let x = event["pos"][0];
                let y = event["pos"][1];
                let z = event["pos"][2];
                let dim = event["dimId"];
                logDebug(`检测到龙蛋传送事件 at (${x}, ${y}, ${z}) 维度: ${dim}`);

                const pos = { x, y, z, dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2) }; // 修正维度ID

                const areaData = getAreaData();
                const spatialIndex = getSpatialIndex(); // 获取空间索引
                const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

                if (areasAtPos.length > 0) {
                    const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
                    const area = areaInfo.area;
                    const areaId = areaInfo.id;

                    // 检查区域是否允许龙蛋传送
                    if(area.rules?.allowDragonEggTeleport === false) { // 显式检查 false 或 undefined
                        logDebug(`区域 ${areaId} (${area.name}) 不允许龙蛋传送，已拦截`);
                        event["cancelled"] = true;  // 拦截传送
                        return;
                    }
                }

                logDebug("允许龙蛋传送");
            },
            iListenAttentively.EventPriority.Normal
        );
    } catch (e) {
        logError(`Failed to register ila::mc::world::level::block::DragonEggBlockTeleportBeforeEvent listener: ${e.message}`);
    }
}

if (config.ruleListenerControl.fireworkDamage) {
    try {
        iListenAttentively.emplaceListener(
            "ila::mc::world::actor::FireworkRocketDealDamageBeforeEvent",
            event => {

                const Firework = iListenAttentively.getActor(event["self"]); // 获取实体对象
                if (!Firework) return;
                const pos = Firework.pos;

                const areaData = getAreaData();
                const spatialIndex = getSpatialIndex();
                const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

                if (areasAtPos.length > 0) {
                    const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
                    const area = areaInfo.area;
                    const areaId = areaInfo.id;

                    // 检查区域是否允许烟花伤害
                    if (area.rules?.allowFireworkDamage === false) { // 显式检查 false 或 undefined
                        logDebug(`区域 ${areaId} (${area.name}) 不允许烟花伤害，已拦截`);
                        event["cancelled"] = true; // 拦截伤害
                        return;
                    }
                }
                // 不在区域内或区域允许
                logDebug(`允许烟花伤害 at (${pos.x}, ${pos.y}, ${pos.z})`);
            },
            iListenAttentively.EventPriority.Normal
        );
    } catch (e) {
        logError(`Failed to register ila::mc::world::actor::FireworkRocketDealDamageBeforeEvent listener: ${e.message}`);
    }
}

if (config.ruleListenerControl.mobGriefing) {
    try {
        iListenAttentively.emplaceListener(
            "ila::mc::world::actor::ActorDestroyBlockEvent", // 监听生物破坏方块事件
            event => {
                // logger.warn(event.toSNBT()); // Debugging line

                const Entity = iListenAttentively.getActor(event["self"]); // 获取实体对象
                if (!Entity) return; // 防御性检查

                // 尝试从事件数据中获取被破坏方块的位置
                const blockPosX = event["pos"][0];
                const blockPosY = event["pos"][1];
                const blockPosZ = event["pos"][2];
                const dim = Entity.pos.dimid // 获取维度

                // 修正 pos 对象，使用正确的属性名 x, y, z, dimid
                const pos = { x: blockPosX, y: blockPosY, z: blockPosZ, dimid: dim };
                //logDebug(`检测到实体 ${Entity.type} 尝试破坏方块 at (${blockPosX}, ${blockPosY}, ${blockPosZ}) 维度: ${dim}`);

                const areaData = getAreaData();
                const spatialIndex = getSpatialIndex();
                const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

                if (areasAtPos.length > 0) {
                    const areaInfo = areasAtPos[0]; // 检查优先级最高的区域
                    const area = areaInfo.area;
                    const areaId = areaInfo.id;
                    if (area.rules?.allowMobGriefing === false) { // Explicitly check for false
                        //logDebug(`区域 ${areaId} (${area.name}) 不允许生物破坏方块，已拦截 ${Entity.type} 的行为`);
                        //event["cancelled"] = true; // 拦截破坏
                        return;
                    }
                }
            },
            iListenAttentively.EventPriority.Normal
        );
    } catch (e) {
        logError(`Failed to register ila::mc::world::actor::ActorDestroyBlockEvent listener: ${e.message}`);
    }
}

//液体 - 仅拦截在区域边界上的流动
if (config.ruleListenerControl.liquidFlow) {
    try {
        iListenAttentively.emplaceListener(
            "ila::mc::world::level::block::LiquidFlowBeforeEvent",
            event => {
                const dimStr = event["dimId"]; // "Overworld", "Nether", "TheEnd"
                const x = event["pos"][0]; // 流向坐标 (目标方块)
                const y = event["pos"][1];
                const z = event["pos"][2];
                const destPos = { x, y, z, dimid: dimStr === "Overworld" ? 0 : (dimStr === "Nether" ? 1 : 2) };

                // logDebug(`检测到液体流动事件 at (${x}, ${y}, ${z}) 维度: ${dimStr}`);

                const areaData = getAreaData();
                const spatialIndex = getSpatialIndex();
                const { getHighestPriorityArea } = require('./utils'); // 确保导入

                // 1. 获取目标位置的最高优先级区域
                const destAreaInfo = getHighestPriorityArea(destPos, areaData, spatialIndex);

                // 2. 如果目标区域存在且禁止液体流动
                if (destAreaInfo && destAreaInfo.area.rules?.allowLiquidFlow === false) { // Explicitly check for false
                    const area = destAreaInfo.area;
                    const areaId = destAreaInfo.id;

                    // 3. 获取区域边界
                    const minX = Math.min(area.point1.x, area.point2.x);
                    const maxX = Math.max(area.point1.x, area.point2.x);
                    const minY = Math.min(area.point1.y, area.point2.y);
                    const maxY = Math.max(area.point1.y, area.point2.y);
                    const minZ = Math.min(area.point1.z, area.point2.z);
                    const maxZ = Math.max(area.point1.z, area.point2.z);

                    // 4. 检查目标坐标是否在边界上
                    const isOnBoundary = (
                        x === minX || x === maxX ||
                        y === minY || y === maxY ||
                        z === minZ || z === maxZ
                    );

                    if (isOnBoundary) {
                        logDebug(`液体流动目标 (${x},${y},${z}) 位于禁止流动的区域 ${areaId} 的边界上，已拦截。`);
                        event["cancelled"] = true;
                        return; // 拦截事件
                    } else {
                        // logDebug(`液体流动目标 (${x},${y},${z}) 在区域 ${areaId} 内部，允许流动。`);
                    }
                } else {
                    // logDebug(`目标位置 (${x},${y},${z}) 不在禁止流动的区域内，或区域允许流动。`);
                }

                // 默认允许流动
            },
            iListenAttentively.EventPriority.Normal
        );
    } catch (e) {
        logError(`Failed to register ila::mc::world::level::block::LiquidFlowBeforeEvent listener: ${e.message}`);
    }
}

