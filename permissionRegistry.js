// permissionRegistry.js - 集中定义所有权限

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