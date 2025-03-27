// permissionRegistry.js - 集中定义所有权限
const {logDebug, logInfo, logWarning, logError } = require('./logger');
// 权限定义
const PERMISSIONS = {
    // 建筑类权限
    BREAK: {
        id: "break",
        name: "破坏方块",
        description: "允许在区域内破坏方块",
        category: "建筑"
    },
    PLACE: {
        id: "place",
        name: "放置方块",
        description: "允许在区域内放置方块",
        category: "建筑"
    },
    PICKUP_ITEMS: {
        id: "pickupItems",
        name: "捡起物品",
        description: "允许在区域内捡起物品",
        category: "物品"
    },
    DROP_ITEMS: {
        id: "dropItems",
        name: "丢出物品",
        description: "允许在区域内丢出物品",
        category: "物品"
    },
    RIDE_ENTITY: {
        id: "rideEntity",
        name: "乘骑生物",
        description: "允许在区域内乘骑生物",
        category: "交互"
    },
    INTERACT_ENTITY: {
        id: "InteractEntity",
        name: "实体交互",
        description: "允许在区域内交互生物",
        category: "交互"
    },
    ARMOR_STAND: {
        id: "armorStand",
        name: "操作盔甲架",
        description: "允许在区域内操作盔甲架",
        category: "交互"
    },
    USE_PRESSURE_PLATE: {
        id: "usePressurePlate",
        name: "踩压力板",
        description: "允许在区域内踩压力板",
        category: "交互"
    },
    // 展示框操作权限
    ITEM_FRAME: {
    id: "itemFrame",
    name: "操作展示框",
    description: "允许在区域内操作展示框",
    category: "交互"
},

// 使用床权限
     USE_BED: {
    id: "useBed", 
    name: "使用床",
    description: "允许在区域内使用床",
    category: "交互"
},

// 对方块使用物品权限
USE_ITEM_ON_BLOCK: {
    id: "useItemOnBlock",
    name: "对方块使用物品",
    description: "允许在区域内对方块使用物品",
    category: "交互"
},

// 使用物品权限
USE_ITEM: {
    id: "useItem",
    name: "使用物品",
    description: "允许在区域内使用物品",
    category: "物品"
},
USE_SHOVEL: {
    id: "useShovel",
    name: "使用铲子",
    description: "允许在区域内使用铲子转换草方块、泥土等",
    category: "交互"
},
USE_AXE: {
    id: "useAxe",
    name: "使用斧头",
    description: "允许在区域内使用斧头转换原木等方块",
    category: "交互"
},
USE_HOE: {
    id: "useHoe",
    name: "使用锄头",
    description: "允许在区域内使用锄头转换泥土、草方块等",
    category: "交互"
},
USE_BOW: {
    id: "useBow",
    name: "使用弓",
    description: "允许在区域内使用弓",
    category: "物品"
},
USE_CROSSBOW: {
    id: "useCrossbow",
    name: "使用弩",
    description: "允许在区域内使用弩",
    category: "物品"
},
USE_TRIDENT: {
    id: "useTrident",
    name: "使用三叉戟",
    description: "允许在区域内使用三叉戟",
    category: "物品"
},
USE_POTION: {
    id: "usePotion",
    name: "使用药水",
    description: "允许在区域内使用普通药水",
    category: "物品"
},
USE_SPLASH_POTION: {
    id: "useSplashPotion",
    name: "使用喷溅药水",
    description: "允许在区域内使用喷溅药水",
    category: "物品"
},
USE_LINGERING_POTION: {
    id: "useLingeringPotion",
    name: "使用滞留药水",
    description: "允许在区域内使用滞留药水",
    category: "物品"
},
USE_EXP_BOTTLE: {
    id: "useExpBottle",
    name: "使用附魔之瓶",
    description: "允许在区域内使用附魔之瓶",
    category: "物品"
},

// 攻击方块权限
ATTACK_BLOCK: {
    id: "attackBlock",
    name: "攻击方块",
    description: "允许在区域内攻击方块",
    category: "交互"
},

// 攻击实体权限
ATTACK_ENTITY: {
    id: "attackEntity",
    name: "攻击实体",
    description: "允许在区域内攻击实体",
    category: "交互"
},

// 使用钓鱼竿钓起实体权限
USE_FISHING_ROD: {
    id: "useFishingRod",
    name: "使用钓鱼竿",
    description: "允许在区域内使用钓鱼竿",
    category: "交互"
},
    // 容器交互权限
    OPEN_CONTAINER: {
        id: "openchest",
        name: "打开箱子",
        description: "允许打开区域内的箱子",
        category: "容器"
    },
    OPEN_ENDERCHEST: {
        id: "openEnderchest",
        name: "打开末影箱",
        description: "允许打开末影箱",
        category: "容器"
    },
    OPEN_TRAPPEDCHEST: {
        id: "opentRapped_chest",
        name: "打开陷阱箱",
        description: "允许打开陷阱箱",
        category: "容器"
    },
    OPEN_CRAFTING: {
        id: "openCrafting",
        name: "使用工作台",
        description: "允许使用区域内的工作台",
        category: "容器"
    },
    OPEN_ANVIL: {
        id: "openAnvil",
        name: "使用铁砧",
        description: "允许使用区域内的铁砧",
        category: "容器"
    },
    OPEN_ENCHANTING: {
        id: "openEnchanting",
        name: "使用附魔台",
        description: "允许使用区域内的附魔台",
        category: "容器"
    },
    OPEN_HOPPER: {
        id: "openHopper",
        name: "使用漏斗",
        description: "允许使用区域内的漏斗",
        category: "容器"
    },
    OPEN_DISPENSER: {
        id: "openDispenser",
        name: "使用发射器",
        description: "允许使用区域内的发射器和投掷器",
        category: "容器"
    },
    OPEN_DROPPER: {
        id: "openDropper",
        name: "使用投掷器",
        description: "允许使用区域内的发射器和投掷器",
        category: "容器"
    },
    OPEN_SHULKER: {
        id: "openShulker",
        name: "使用潜影盒",
        description: "允许使用区域内的潜影盒",
        category: "容器"
    },
    OPEN_BARREL: {
        id: "openBarrel",
        name: "使用桶",
        description: "允许使用区域内的桶",
        category: "容器"
    },
    OPEN_FURNACE: {
        id: "openFurnace",
        name: "使用熔炉",
        description: "允许使用区域内的熔炉",
        category: "容器"
    },
    OPEN_BLAST_FURNACE: {
        id: "openBlastFurnace",
        name: "使用高炉",
        description: "允许使用区域内的高炉",
        category: "容器"
    },
    OPEN_SMOKER: {
        id: "openSmoker",
        name: "使用烟熏炉",
        description: "允许使用区域内的烟熏炉",
        category: "容器"
    },
    OPEN_CARTOGRAPHY: {
        id: "openCartography",
        name: "使用制图台",
        description: "允许使用区域内的制图台",
        category: "容器"
    },
    OPEN_STONECUTTER: {
        id: "openStonecutter",
        name: "使用切石机",
        description: "允许使用区域内的切石机",
        category: "容器"
    },
    OPEN_BREWING_STAND: {
        id: "openBrewingStand",
        name: "使用酿造台",
        description: "允许使用区域内的酿造台",
        category: "容器"
    },
    OPEN_CRAFTER: {
        id: "openCrafter",
        name: "使用合成器",
        description: "允许使用区域内的合成器",
        category: "容器"
    },
    OPEN_BEACON: {
        id: "openBeacon",
        name: "使用信标",
        description: "允许使用区域内的信标",
        category: "容器"
    },
    OPEN_GRINDSTONE: {
        id: "openGrindstone",
        name: "使用砂轮",
        description: "允许使用区域内的砂轮",
        category: "容器"
    },
    OPEN_OTHER_CONTAINER: {
        id: "openOtherContainer",
        name: "使用其他容器",
        description: "允许使用区域内的其他容器类型",
        category: "容器"
    },
    // 管理类权限
    MANAGE: {
        id: "manage",
        name: "管理区域",
        description: "允许管理区域设置和权限",
        category: "管理"
    },
    DELETE: {
        id: "delete",
        name: "删除区域",
        description: "允许删除整个区域",
        category: "管理"
    },
    GRANT_ADMIN_PERMISSIONS: {
    id: "grantAdminPermissions",
    name: "授予管理权限",
    description: "允许为玩家设置包含管理权限的权限组",
    category: "管理"
    },
    SET_PLAYER_PERMISSIONS: {
        id: "setPlayerPermissions",
        name: "管理玩家权限",
        description: "允许为其他玩家设置权限组",
        category: "管理"
    },
    RESIZE_AREA: {
        id: "resizeArea",
        name: "修改区域范围",
        description: "允许更改区域的边界",
        category: "管理"
    },
    SET_AREA_RULES: {
        id: "setAreaRules",
        name: "设置区域规则",
        description: "允许修改区域规则",
        category: "管理"
    },
    RENAME: {
        id: "rename",
        name: "修改区域名称",
        description: "允许修改区域的名称",
        category: "管理"
    },
    SUBAREA_MANAGE: {
        id: "subareaManage",
        name: "管理子区域",
        description: "允许创建和管理子区域",
        category: "管理"
    },
    SUBAREA_SETTINGS: {
        id: "subareaSettings", 
        name: "设置子区域",
        description: "允许修改子区域的设置",
        category: "管理"
    }
};

// 将权限按类别分组
function getPermissionsByCategory() {
    const categories = {};
    
    for (const key in PERMISSIONS) {
        const perm = PERMISSIONS[key];
        if (!categories[perm.category]) {
            categories[perm.category] = [];
        }
        categories[perm.category].push(perm);
    }
    
    return categories;
}

// 将权限按类别分组
function getPermissionsByCategory() {
    const categories = {};
    
    for (const key in PERMISSIONS) {
        const perm = PERMISSIONS[key];
        if (!categories[perm.category]) {
            categories[perm.category] = [];
        }
        categories[perm.category].push(perm);
    }
    
    return categories;
}

// 获取所有权限ID列表
function getAllPermissionIds() {
    return Object.values(PERMISSIONS).map(p => p.id);
}

// 获取所有权限分类
function getAllCategories() {
    return [...new Set(Object.values(PERMISSIONS).map(p => p.category))];
}

module.exports = {
    PERMISSIONS,
    getPermissionsByCategory,
    getAllPermissionIds,
    getAllCategories
};