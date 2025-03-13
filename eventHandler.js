
const { isInArea ,getPriorityAreasAtPosition } = require('./utils');
const { getAreaData } = require('./czland');
const { checkPermission } = require('./permission');
const { PERMISSIONS } = require('./permissionRegistry');
const { loadConfig } = require('./configManager');
const config = loadConfig();
const iListenAttentively = require('../iListenAttentively-LseExport/lib/iListenAttentively.js');

function checkPriorityPermission(player, pos, permissionId) {
    const areaData = getAreaData();
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData);
    
    // 如果不在任何区域内，允许操作
    if (areasAtPos.length === 0) {
        logger.info("位置不在任何区域内，默认允许操作");
        return true;
    }
    
    // 遍历区域（按优先级排序，子区域优先）
    for (const areaInfo of areasAtPos) {
        const areaId = areaInfo.id;
        const area = areaInfo.area;
        
        logger.info(`检查区域 ${areaId} (${area.name}) 权限`);
        
        // 检查玩家是否有权限
        const hasPermission = checkPermission(player, areaData, areaId, permissionId);
        
        // 只要有一个区域允许，就立即返回允许
        if (hasPermission) {
            logger.info(`权限检查通过，区域 ${areaId} 授予权限`);
            return true;
        }
    }
    
    // 所有区域都不允许
    logger.info("所有相关区域均拒绝权限");
    return false;
}

// 监听玩家破坏方块事件
mc.listen("onDestroyBlock", function(player, block) {
    const pos = block.pos;
    const areaData = getAreaData();
    
    logger.info(`玩家 ${player.name} 尝试破坏方块 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            logger.info(`方块在区域 ${areaId} (${area.name}) 内`);
        
            
            // 检查玩家是否有权限
            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.BREAK.id);

            logger.info(`权限检查结果: ${hasPermission}`);
            
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域破坏方块！");
                return false;
            }
        }
    }
    
    logger.info("允许破坏方块");
    return true;
});

// 监听玩家放置方块事件
mc.listen("onPlaceBlock", function(player, block) {
    const pos = block.pos;
    const areaData = getAreaData();
    
    logger.info(`玩家 ${player.name} 尝试放置方块 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            logger.info(`方块在区域 ${areaId} (${area.name}) 内`);
            
            // 检查玩家是否有权限

            const hasPermission = checkPriorityPermission(player, pos, PERMISSIONS.PLACE.id);
            logger.info(`权限检查结果: ${hasPermission}`);
            
            if(!hasPermission) {
                player.tell("§c你没有权限在此区域放置方块！");
                return false;
            }
        }
    }
    
    logger.info("允许放置方块");
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
            logger.info(`方块在区域 ${areaId} (${area.name}) 内`);
            
            switch(block.type) {
                case "minecraft:chest":
                    permissionId = PERMISSIONS.OPEN_CONTAINER.id
                    logger.info(`检测到箱子，需要权限: ${permissionId}`);
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


// 然后监听丢弃物品事件
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
    
    logger.info(`检测到实体爆炸事件 at (${pos.x}, ${pos.y}, ${pos.z}), 实体类型: ${entity.type}`);
    
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
                logger.info(`区域 ${areaId} 不允许 ${entity.type} 类型的爆炸`);
                return false;
            }
        }
    }
    return true;
});

mc.listen("onBlockExplode", function(source, pos) {  // 修改参数以匹配API
    const areaData = getAreaData();
    
    logger.info(`检测到方块爆炸事件 at (${pos.x}, ${pos.y}, ${pos.z}), 来源: ${source ? source.type : "unknown"}`);
    
    // 遍历所有受影响的方块
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            // 检查区域是否允许方块爆炸
            if(!area.rules || !area.rules.allowBlockExplosion) {
                logger.info(`区域 ${areaId} (${area.name}) 不允许方块爆炸，已拦截`);
                return false; // 拦截爆炸
            }
        }
    }
    
    logger.info("未找到需要保护的区域，允许爆炸");
    return true;
});

// 监听火焰蔓延事件
mc.listen("onFireSpread", function(pos) {
    const areaData = getAreaData();
    
    logger.info(`检测到火焰蔓延 at (${pos.x}, ${pos.y}, ${pos.z})`);
    
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
            // 检查区域是否允许火焰蔓延
            if(!area.rules || !area.rules.allowFireSpread) {
                logger.info(`区域 ${areaId} 不允许火焰蔓延`);
                return false;
            }
        }
    }
    return true;
});
function log(message) {
    logger.info(`[区域系统] ${message}`);
}

