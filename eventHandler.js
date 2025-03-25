
const { isInArea ,getPriorityAreasAtPosition } = require('./utils');
const { getAreaData } = require('./czareaprotection');
const { checkPermission } = require('./permission');
const { PERMISSIONS } = require('./permissionRegistry');
const { loadConfig } = require('./configManager');
const config = loadConfig();
const iListenAttentively = require('../iListenAttentively-LseExport/lib/iListenAttentively.js');
const {logDebug, logInfo, logWarning, logError } = require('./logger');

function checkPriorityPermission(player, pos, permissionId) {
    const areaData = getAreaData();
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData);
    
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
    
    logDebug(`玩家 ${player.name} 尝试破坏方块 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            logDebug(`方块在区域 ${areaId} (${area.name}) 内`);
        
            
            // 检查玩家是否有权限
            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.BREAK.id);

            logDebug(`权限检查结果: ${hasPermission}`);
            
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域破坏方块！");
                return false;
            }
        }
    }
    
    logDebug("允许破坏方块");
    return true;
});

// 监听玩家放置方块事件
mc.listen("onPlaceBlock", function(player, block) {
    const pos = block.pos;
    const areaData = getAreaData();
    
    logDebug(`玩家 ${player.name} 尝试放置方块 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            logDebug(`方块在区域 ${areaId} (${area.name}) 内`);
            
            // 检查玩家是否有权限

            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.PLACE.id);
            logDebug(`权限检查结果: ${hasPermission}`);
            
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域放置方块！");
                return false;
            }
        }
    }
    
    logDebug("允许放置方块");
    return true;
});

// 监听容器交互
mc.listen("onOpenContainer", function(player, block) {
    const pos = block.pos;
    const areaData = getAreaData();
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            // 根据不同容器类型检查权限
            let permissionId;
            logDebug(`方块在区域 ${areaId} (${area.name}) 内`);
            
            switch(block.type) {
                case "minecraft:chest":
                    permissionId = PERMISSIONS.OPEN_CONTAINER.id
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
                    permissionId = PERMISSIONS.OPEN_DROPPER.id;
                    break;
                case "minecraft:dropper":
                    permissionId = PERMISSIONS.OPEN_DISPENSER.id;
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
                const hasPermission = checkPriorityPermission(player, pos, permissionId);
                if(!hasPermission) {
                    player.tell("§c你没有权限操作这个容器！");
                    return false;
                }
            }
        }
    }
    return true;
});

// 监听物品拾取
mc.listen("onTakeItem", function(player, item) {
    const pos = item.pos;
    const areaData = getAreaData();
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.PICKUP_ITEMS.id);
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域拾取物品！");
                return false;
            }
        }
    }
    return true;
});

//*
// 监听丢弃物品事件
iListenAttentively.emplaceListener(
    "ila::mc::world::actor::player::PlayerDropItemAfterEvent",
    event => {
        const player = iListenAttentively.getPlayer(event["self"]);
        logger.warn(event.toSNBT());
        logger.warn(`，玩家: ${iListenAttentively.getPlayer(event["self"]).realName}, }`);
        
        const pos = player.pos;
        const areaData = getAreaData();
        
        for(let areaId in areaData) {
            const area = areaData[areaId];
            if(isInArea(pos, area)) {
                const hasPermission = checkPermission(player, areaData, areaId, PERMISSIONS.DROP_ITEMS.id);
                if(!hasPermission) {
                    player.tell("§c你没有权限在此区域丢弃物品！");
                    event["cancelled"] = true; //拦截
                    return;
                }
            }
        }
    },
    iListenAttentively.EventPriority.High
);
/*

// 监听物品丢弃
mc.listen("onDropItem", function(player, item) {
    const pos = player.pos;
    const areaData = getAreaData();
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            const hasPermission = checkPermission(player, areaData, areaId, PERMISSIONS.DROP_ITEMS.id);
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域丢弃物品！");
                return false;
            }
        }
    }
    return true;
});
*/
// 监听爆炸事件
mc.listen("onEntityExplode", function(entity, pos) {
    const areaData = getAreaData();
    
    logDebug(`检测到实体爆炸事件 at (${pos.x}, ${pos.y}, ${pos.z}), 实体类型: ${entity.type}`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            // 根据实体类型判断允许规则
            let isAllowed = false;
            
            switch(entity.type) {
                case "minecraft:creeper":
                    isAllowed = area.rules?.allowCreeperExplosion;
                    break;
                    
                case "minecraft:fireball":
                    isAllowed = area.rules?.allowFireballExplosion;
                    break;
                    
                case "minecraft:ender_crystal":
                    isAllowed = area.rules?.allowCrystalExplosion;
                    break;
                    
                case "minecraft:wither":
                    isAllowed = area.rules?.allowWitherExplosion;
                    break;
                    
                case "minecraft:wither_skull":
                case "minecraft:wither_skull_dangerous":
                    isAllowed = area.rules?.allowWitherSkullExplosion;
                    break;
                    
                case "minecraft:tnt_minecart":
                    isAllowed = area.rules?.allowTntMinecartExplosion;
                    break;
                    
                case "minecraft:wind_charge_projectile":
                    isAllowed = area.rules?.allowWindChargeExplosion;
                    break;
                    
                case "minecraft:breeze_wind_charge_projectile":
                    isAllowed = area.rules?.allowBreezeWindChargeExplosion;
                    break;
                    
                default:
                    isAllowed = area.rules?.allowOtherExplosion;
                    break;
            }
            
            if(!isAllowed) {
                logDebug(`区域 ${areaId} 不允许 ${entity.type} 类型的爆炸`);
                return false;
            }
        }
    }
    return true;
});

mc.listen("onBlockExplode", function(source, pos) {  // 修改参数以匹配API
    const areaData = getAreaData();
    
    logDebug(`检测到方块爆炸事件 at (${pos.x}, ${pos.y}, ${pos.z}), 来源: ${source ? source.type : "unknown"}`);
    
    // 遍历所有受影响的方块
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            // 检查区域是否允许方块爆炸
            if(!area.rules || !area.rules.allowBlockExplosion) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许方块爆炸，已拦截`);
                return false; // 拦截爆炸
            }
        }
    }
    
    logDebug("未找到需要保护的区域，允许爆炸");
    return true;
});

// 监听火焰蔓延事件
mc.listen("onFireSpread", function(pos) {
    const areaData = getAreaData();
    
    logDebug(`检测到火焰蔓延 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            // 检查区域是否允许火焰蔓延
            if(!area.rules || !area.rules.allowFireSpread) {
                logDebug(`区域 ${areaId} 不允许火焰蔓延`);
                return false;
            }
        }
    }
    return true;
});

iListenAttentively.emplaceListener(
    "ila::mc::world::FireTryBurnBlockBeforeEvent",
    event => {
        // 获取火焰尝试燃烧的方块位置
        let dim = event["dimid"]  // 字符串三个维度分别是Overworld Nether TheEnd
        let x = event["pos"][0]
        let y = event["pos"][1]
        let z = event["pos"][2]
        
        // 创建位置对象
        const pos = {
            x: x,
            y: y,
            z: z,
            dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? 1 : 2)  // 转换维度ID
        };
        
        logDebug(`检测到火焰尝试燃烧方块 at (${x}, ${y}, ${z}) 维度: ${dim}`);
        
        // 获取区域数据
        const areaData = getAreaData();
        
        // 检查是否在保护区域内
        for(let areaId in areaData) {
            const area = areaData[areaId];
            if(isInArea(pos, area)) {
                // 检查区域是否允许火焰烧毁方块
                if(!area.rules || !area.rules.allowFireBurnBlock) {
                    logDebug(`区域 ${areaId} (${area.name}) 不允许火焰烧毁方块，已拦截`);
                    event["cancelled"] = true;  // 拦截燃烧
                    return;
                }
            }
        }
        
        // 不在任何区域内或所有区域允许，不拦截
        logDebug("允许火焰烧毁方块");
    },
    iListenAttentively.EventPriority.High
);

// 苔藓生长事件
iListenAttentively.emplaceListener(
    "ila::mc::world::level::block::MossGrowthBeforeEvent",
    event => {
        // 获取苔藓生长的方块位置
        let dim = event["dimid"]  // 字符串三个维度分别是Overworld Nether TheEnd
        let x = event["pos"][0]
        let y = event["pos"][1]
        let z = event["pos"][2]
        
        // 创建位置对象
        const pos = {
            x: x,
            y: y,
            z: z,
            dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1)  // 转换维度ID
        };
        
        logDebug(`检测到苔藓生长 at (${x}, ${y}, ${z}) 维度: ${dim}`);
        
        // 获取区域数据
        const areaData = getAreaData();
        
        // 检查是否在保护区域内
        for(let areaId in areaData) {
            const area = areaData[areaId];
            if(isInArea(pos, area)) {
                // 检查区域是否允许苔藓生长
                if(!area.rules || !area.rules.allowMossGrowth) {
                    logDebug(`区域 ${areaId} (${area.name}) 不允许苔藓生长，已拦截`);
                    event["cancelled"] = true;  // 拦截生长
                    return;
                }
            }
        }
        
        // 不在任何区域内或所有区域允许，不拦截
        logDebug("允许苔藓生长");
    },
    iListenAttentively.EventPriority.High
);

// 幽匿催发体生成事件
iListenAttentively.emplaceListener(
    "ila::mc::world::level::block::SculkSpreadBeforeEvent",
    event => {
        // 获取幽匿催发体生成的方块位置
        let dim = event["dimid"]  // 字符串三个维度分别是Overworld Nether TheEnd
        let x = event["selfPos"][0]
        let y = event["selfPos"][1]
        let z = event["selfPos"][2]
        
        // 创建位置对象
        const pos = {
            x: x,
            y: y,
            z: z,
            dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1)  // 转换维度ID
        };
        
        //logDebug(`检测到幽匿催发体生成 at (${x}, ${y}, ${z}) 维度: ${dim}`);
        
        // 获取区域数据
        const areaData = getAreaData();
        
        // 检查是否在保护区域内
        for(let areaId in areaData) {
            const area = areaData[areaId];
            if(isInArea(pos, area)) {
                // 检查区域是否允许幽匿催发体生成
                if(!area.rules || !area.rules.allowSculkSpread) {
                    logDebug(`区域 ${areaId} (${area.name}) 不允许幽匿催发体生成，已拦截`);
                    event["cancelled"] = true;  // 拦截生成
                    return;
                }
            }
        }
        
        // 不在任何区域内或所有区域允许，不拦截
        //logDebug("允许幽匿催发体生成");
    },
    iListenAttentively.EventPriority.High
);
/*
// 液体流动事件
iListenAttentively.emplaceListener(
    "ila::mc::world::level::block::LiquidTryFlowBeforeEvent",
    event => {
        let dim = event["dimid"]  // 字符串三个维度分别是Overworld Nether TheEnd
        let fromX = event["flowFromPos"][0] // 源头坐标
        let fromY = event["flowFromPos"][1]
        let fromZ = event["flowFromPos"][2]  
        let toX = event["pos"][0] // 目标坐标
        let toY = event["pos"][1]
        let toZ = event["pos"][2]
        
        // 创建源头和目标位置对象
        const fromPos = {
            x: fromX,
            y: fromY,
            z: fromZ,
            dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1)
        };
        
        const toPos = {
            x: toX,
            y: toY,
            z: toZ,
            dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1)
        };
        
        
        // 获取区域数据
        const areaData = getAreaData();
        
        // 检查目标位置是否在保护区域内，源头位置不在同一区域内
        for(let areaId in areaData) {
            const area = areaData[areaId];
            if(isInArea(toPos, area) && !isInArea(fromPos, area)) {
                // 检查区域是否允许外部液体流入
                if(!area.rules || !area.rules.allowLiquidFlow) {
                    logDebug(`区域 ${areaId} (${area.name}) 不允许外部液体流入，已拦截`);
                    event["cancelled"] = true;  // 拦截流动
                    return;
                }
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
    
    logDebug(`检测到实体踩压力板 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            // 如果是玩家，使用玩家权限处理
            if(entity.isPlayer()) {
                const player = entity.toPlayer(); // 正确转换为玩家对象
                if(player) {
                    logDebug(`玩家 ${player.name} 踩压力板，检查权限`);
                    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_PRESSURE_PLATE.id);
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
    }
    
    return true;
});

// 乘骑事件 
mc.listen("onRide", function(entity1, entity2) {
    const pos = entity2.pos; // 使用被骑乘实体的位置
    const areaData = getAreaData();
    
    logDebug(`检测到实体乘骑事件 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            if(entity1.isPlayer()) {
                const player = entity1.toPlayer(); 
                if(player) {
                    logDebug(`玩家 ${player.name} 尝试骑乘实体，检查权限`);
                    const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.RIDE_ENTITY.id);
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
    }
    
    return true;
});

// 凋灵破坏方块事件
mc.listen("onWitherBossDestroy", function(witherBoss, AAbb, aaBB) {
    // 检查破坏范围是否与保护区域重叠
    const areaData = getAreaData();
    
    // 创建一个用于检查的区域对象
    const destroyArea = {
        point1: {
            x: AAbb.x,
            y: AAbb.y,
            z: AAbb.z
        },
        point2: {
            x: aaBB.x,
            y: aaBB.y,
            z: aaBB.z
        },
        dimid: witherBoss.pos.dimid
    };
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        // 使用utils.js中的checkAreasOverlap函数检查是否重叠
        if(checkAreasOverlap(destroyArea, area)) {
            // 检查区域是否允许凋灵破坏方块
            if(!area.rules || !area.rules.allowWitherDestroy) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许凋灵破坏方块，已拦截`);
                return false; // 拦截破坏行为
            }
        }
    }
    
    return true;
});

// 生物自然生成事件
mc.listen("onMobTrySpawn", function(typeName, pos) {
    const areaData = getAreaData();
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            // 检查区域是否允许生物自然生成
            if(!area.rules || !area.rules.allowMobNaturalSpawn) {
                logDebug(`区域 ${areaId} (${area.name}) 不允许生物自然生成，已拦截 ${typeName}`);
                return false; // 拦截生成
            }
        }
    }
    
    return true;
});

// 操作盔甲架事件
mc.listen("onChangeArmorStand", function(armorStand, player, slot) {
    const pos = armorStand.pos;
    const areaData = getAreaData();
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.ARMOR_STAND.id);
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域操作盔甲架！");
                return false;
            }
        }
    }
    
    return true;
});
// 末影人拿起方块事件
iListenAttentively.emplaceListener(
    "ila::mc::world::actor::EndermanTakeBlockBeforeEvent",
    event => {
        // 获取末影人拿起方块的位置
        let dim = event["dimid"]  // 字符串三个维度分别是Overworld Nether TheEnd
        let x = event["pos"][0]
        let y = event["pos"][1]
        let z = event["pos"][2]
        
        // 创建位置对象
        const pos = {
            x: x,
            y: y,
            z: z,
            dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1)  // 转换维度ID
        };
        
        logDebug(`检测到末影人拿起方块 at (${x}, ${y}, ${z}) 维度: ${dim}`);
        
        // 获取区域数据
        const areaData = getAreaData();
        
        // 检查是否在保护区域内
        for(let areaId in areaData) {
            const area = areaData[areaId];
            if(isInArea(pos, area)) {
                // 检查区域是否允许末影人拿起方块
                if(!area.rules || !area.rules.allowEndermanTakeBlock) {
                    logDebug(`区域 ${areaId} (${area.name}) 不允许末影人拿起方块，已拦截`);
                    event["cancelled"] = true;  // 拦截操作
                    return;
                }
            }
        }
        
        // 不在任何区域内或所有区域允许，不拦截
        logDebug("允许末影人拿起方块");
    },
    iListenAttentively.EventPriority.High
);

// 末影人放置方块事件
iListenAttentively.emplaceListener(
    "ila::mc::world::actor::EndermanLeaveBlockBeforeEvent",
    event => {
        // 获取末影人放置方块的位置
        let dim = event["dimid"]  // 字符串三个维度分别是Overworld Nether TheEnd
        let x = event["pos"][0]
        let y = event["pos"][1]
        let z = event["pos"][2]
        
        // 创建位置对象
        const pos = {
            x: x,
            y: y,
            z: z,
            dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1)  // 转换维度ID
        };
        
        logDebug(`检测到末影人放置方块 at (${x}, ${y}, ${z}) 维度: ${dim}`);
        
        // 获取区域数据
        const areaData = getAreaData();
        
        // 检查是否在保护区域内
        for(let areaId in areaData) {
            const area = areaData[areaId];
            if(isInArea(pos, area)) {
                // 检查区域是否允许末影人放置方块
                if(!area.rules || !area.rules.allowEndermanPlaceBlock) {
                    logDebug(`区域 ${areaId} (${area.name}) 不允许末影人放置方块，已拦截`);
                    event["cancelled"] = true;  // 拦截操作
                    return;
                }
            }
        }
        
        // 不在任何区域内或所有区域允许，不拦截
        logDebug("允许末影人放置方块");
    },
    iListenAttentively.EventPriority.High
);

// 爆炸事件处理(考虑爆炸范围)
iListenAttentively.emplaceListener(
    "ila::mc::world::ExplosionBeforeEvent",
    event => {
        let radius = event["radius"]; 
        let x = event["pos"][0]
        let y = event["pos"][1]
        let z = event["pos"][2]
        let dim = event["dimid"]  
        
        const explosionPos = {
            x: x,
            y: y,
            z: z,
            dimid: dim === "Overworld" ? 0 : (dim === "Nether" ? -1 : 1)  // 转换维度ID
        };
        
        logDebug(`检测到爆炸事件 at (${x}, ${y}, ${z}) 维度: ${dim}, 半径: ${radius}`);
        
        // 获取区域数据
        const areaData = getAreaData();
        let shouldPreventBlockDamage = false;
        
        // 遍历所有区域，检查爆炸影响
        for(let areaId in areaData) {
            const area = areaData[areaId];
            
            // 创建区域的边界信息
            const minX = Math.min(area.point1.x, area.point2.x);
            const maxX = Math.max(area.point1.x, area.point2.x);
            const minY = Math.min(area.point1.y, area.point2.y);
            const maxY = Math.max(area.point1.y, area.point2.y);
            const minZ = Math.min(area.point1.z, area.point2.z);
            const maxZ = Math.max(area.point1.z, area.point2.z);
            
            // 检查爆炸是否发生在区域内
            const isExplosionInArea = 
                explosionPos.dimid === area.dimid && 
                explosionPos.x >= minX && explosionPos.x <= maxX &&
                explosionPos.y >= minY && explosionPos.y <= maxY &&
                explosionPos.z >= minZ && explosionPos.z <= maxZ;
            
            if (isExplosionInArea) {
                // 如果爆炸在区域内，检查区域规则是否允许爆炸破坏方块
                if (!area.rules || !area.rules.allowExplosionDamageBlock) {
                    logDebug(`爆炸在区域 ${areaId} (${area.name}) 内，不允许破坏方块`);
                    shouldPreventBlockDamage = true;
                    break;
                }
            } else if (explosionPos.dimid === area.dimid) {
                // 爆炸在区域外，但可能影响区域内方块
                // 计算爆炸到区域边界的最短距离
                let distX = 0;
                let distY = 0;
                let distZ = 0;
                
                if (explosionPos.x < minX) distX = minX - explosionPos.x;
                else if (explosionPos.x > maxX) distX = explosionPos.x - maxX;
                
                if (explosionPos.y < minY) distY = minY - explosionPos.y;
                else if (explosionPos.y > maxY) distY = explosionPos.y - maxY;
                
                if (explosionPos.z < minZ) distZ = minZ - explosionPos.z;
                else if (explosionPos.z > maxZ) distZ = explosionPos.z - maxZ;
                
                const distToArea = Math.sqrt(distX * distX + distY * distY + distZ * distZ);
                
                // 如果爆炸范围可能影响到区域，且区域不允许爆炸破坏
                if (distToArea <= radius && (!area.rules || !area.rules.allowExplosionDamageBlock)) {
                    logDebug(`爆炸范围(${radius})与区域 ${areaId} (${area.name}) 重叠，距离: ${distToArea}，不允许破坏方块`);
                    shouldPreventBlockDamage = true;
                    break;
                }
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
    
    logDebug(`玩家 ${player.name} 尝试攻击实体 ${entity.type} at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            logDebug(`实体在区域 ${areaId} (${area.name}) 内`);
            
            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.ATTACK_ENTITY.id);
            logDebug(`权限检查结果: ${hasPermission}`);
            
            if(!hasPermission) {
                return false;
            }
        }
    }
    
    return true;
});

// 监听玩家攻击方块事件
mc.listen("onAttackBlock", function(player, block, item) {
    const pos = block.pos;
    const areaData = getAreaData();
    
    logDebug(`玩家 ${player.name} 尝试攻击方块 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            logDebug(`方块在区域 ${areaId} (${area.name}) 内`);
            
            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.ATTACK_BLOCK.id);
            logDebug(`权限检查结果: ${hasPermission}`);
            
            if(!hasPermission) {
                return false;
            }
        }
    }
    
    return true;
});

// 监听玩家使用物品事件
mc.listen("onUseItem", function(player, item) {
    const pos = player.pos;
    const areaData = getAreaData();
    
    logDebug(`玩家 ${player.name} 尝试使用物品 ${item.type} at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            logDebug(`玩家在区域 ${areaId} (${area.name}) 内`);
            
            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_ITEM.id);
            logDebug(`权限检查结果: ${hasPermission}`);
            
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域使用物品！");
                return false;
            }
        }
    }
    
    return true;
});

// 监听玩家对方块使用物品事件
mc.listen("onUseItemOn", function(player, item, block, side, pos) {
    const blockPos = block.pos;
    const areaData = getAreaData();
    
    logDebug(`玩家 ${player.name} 尝试对方块使用物品 at (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(blockPos, area)) {
            logDebug(`方块在区域 ${areaId} (${area.name}) 内`);
            
            const hasPermission = checkPriorityPermission(player, blockPos, PERMISSIONS.USE_ITEM_ON_BLOCK.id);
            logDebug(`权限检查结果: ${hasPermission}`);
            
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域对方块使用物品！");
                return false;
            }
        }
    }
    
    return true;
});

// 监听玩家上床事件
mc.listen("onBedEnter", function(player, pos) {
    const areaData = getAreaData();
    
    logDebug(`玩家 ${player.name} 尝试上床 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            logDebug(`床在区域 ${areaId} (${area.name}) 内`);
            
            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_BED.id);
            logDebug(`权限检查结果: ${hasPermission}`);
            
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域使用床！");
                return false;
            }
        }
    }
    
    return true;
});

// 监听玩家使用钓鱼竿钓起实体事件
mc.listen("onPlayerPullFishingHook", function(player, entity, item) {
    const pos = entity.pos;
    const areaData = getAreaData();
    
    logDebug(`玩家 ${player.name} 尝试钓起实体 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            logDebug(`实体在区域 ${areaId} (${area.name}) 内`);
            
            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.USE_FISHING_ROD.id);
            logDebug(`权限检查结果: ${hasPermission}`);
            
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域使用钓鱼竿！");
                return false;
            }
        }
    }
    
    return true;
});

// 监听玩家与展示框交互事件
mc.listen("onPlayerInteractEntity", function(player, entity, pos) {
    // 检查是否是物品展示框类型
    if (entity.type === "minecraft:item_frame" || entity.type === "minecraft:glow_item_frame") {
        const entityPos = entity.pos;
        const areaData = getAreaData();
        
        logDebug(`玩家 ${player.name} 尝试操作展示框 at (${entityPos.x}, ${entityPos.y}, ${entityPos.z})`);
        
        for(let areaId in areaData) {
            const area = areaData[areaId];
            if(isInArea(entityPos, area)) {
                logDebug(`展示框在区域 ${areaId} (${area.name}) 内`);
                
                const hasPermission = checkPriorityPermission(player, entityPos, PERMISSIONS.ITEM_FRAME.id);
                logDebug(`权限检查结果: ${hasPermission}`);
                
                if(!hasPermission) {
                    player.tell("§c你没有权限在此区域操作展示框！");
                    return false;
                }
            }
        }
    }
    
    return true;
});

