// permissionRegistry.js - 集中定义所有权限
const { logDebug, logInfo, logWarning, logError } = require('./logger');

// 使用相对于插件根目录的路径
const PERMISSIONS_PATH = './plugins/area/permissions.json';

// 默认权限定义 (用于首次创建配置文件或加载失败时回退)
const DEFAULT_PERMISSIONS = {
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
        name: "乘骑实体", // Changed 生物 to 实体
        description: "允许在区域内乘骑指定的实体 (如: 船, 矿车, 马等)", // Updated description
        category: "交互"
    },
    INTERACT_ENTITY: {
        id: "interactEntity", // Corrected ID casing
        name: "实体交互",
        description: "允许在区域内与指定的实体交互 (如: 村民, 带箱矿车等)", // Updated description
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
    USE_DAYLIGHT_DETECTOR: {
        id: "useDaylightDetector",
        name: "使用阳光探测器",
        description: "允许在区域内使用阳光探测器",
        category: "交互"
    },
    USE_CAULDRON: {
        id: "useCauldron",
        name: "使用炼药锅",
        description: "允许在区域内使用炼药锅",
        category: "交互"
    },
    USE_COMPARATOR: {
        id: "useComparator",
        name: "使用红石比较器",
        description: "允许在区域内使用红石比较器",
        category: "交互"
    },
    USE_REPEATER: {
        id: "useRepeater",
        name: "使用红石中继器",
        description: "允许在区域内使用红石中继器",
        category: "交互"
    },
    USE_NOTEBLOCK: {
        id: "useNoteblock",
        name: "使用音符盒",
        description: "允许在区域内使用音符盒",
        category: "交互"
    },
    USE_JUKEBOX: {
        id: "useJukebox",
        name: "使用唱片机",
        description: "允许在区域内使用唱片机",
        category: "交互"
    },
    USE_BUTTON: {
        id: "useButton",
        name: "使用按钮",
        description: "允许在区域内使用按钮",
        category: "交互"
    },
    USE_LEVER: {
        id: "useLever",
        name: "使用拉杆",
        description: "允许在区域内使用拉杆",
        category: "交互"
    },
    USE_COMPOSTER: {
        id: "useComposter", 
        name: "使用堆肥桶",
        description: "允许在区域内使用堆肥桶",
        category: "交互"
    },
    USE_DOOR: {
        id: "useDoor",
        name: "使用门",
        description: "允许在区域内使用门",
        category: "交互"
    },
    USE_TRAPDOOR: {
        id: "useTrapdoor",
        name: "使用活板门",
        description: "允许在区域内使用活板门",
        category: "交互"
    },
    USE_FENCE_GATE: {
        id: "useFenceGate",
        name: "使用栅栏门",
        description: "允许在区域内使用栅栏门",
        category: "交互"
    },
    USE_CAMPFIRE: {
        id: "useCampfire",
        name: "使用营火",
        description: "允许在区域内使用营火",
        category: "交互"
    },
    USE_BEEHIVE: {
        id: "useBeehive",
        name: "使用蜂巢/蜂箱",
        description: "允许在区域内使用蜂巢或蜂箱",
        category: "交互"
    },
    USE_BOOKSHELF: {
        id: "useBookshelf",
        name: "使用书架",
        description: "允许在区域内使用雕纹书架",
        category: "交互"
    },
    USE_SUSPICIOUS_BLOCK: {
        id: "useSuspiciousBlock",
        name: "使用可疑方块",
        description: "允许在区域内使用可疑的沙子或沙砾",
        category: "交互"
    },
    USE_RESPAWN_ANCHOR: {
        id: "useRespawnAnchor",
        name: "使用重生锚",
        description: "允许在区域内使用重生锚",
        category: "交互"
    },
    USE_CANDLE: {
        id: "useCandle",
        name: "使用蜡烛",
        description: "允许在区域内使用蜡烛",
        category: "交互"
    },
    USE_SIGN: {
        id: "useSign",
        name: "使用告示牌",
        description: "允许在区域内使用告示牌",
        category: "交互"
    },
    INTERACT_DRAGON_EGG: {
        id: "interactDragonEgg",
        name: "交互龙蛋",
        description: "允许在区域内交互龙蛋",
        category: "交互"
    },
    ITEM_FRAME: {
        id: "itemFrame",
        name: "操作展示框",
        description: "允许在区域内操作展示框",
        category: "交互"
    },
    USE_BED: {
        id: "useBed",
        name: "使用床",
        description: "允许在区域内使用床",
        category: "交互"
    },
    USE_ITEM_ON_BLOCK: {
        id: "useItemOnBlock",
        name: "对方块使用物品",
        description: "允许在区域内对方块使用物品",
        category: "交互"
    },
    INTERACT_BLOCK: {
        id: "interactBlock",
        name: "方块互动",
        description: "允许在区域内与方块互动",
        category: "交互"
    },
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
    USE_BUCKET: {
        id: "useBucket",
        name: "使用桶",
        description: "允许在区域内使用桶",
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
    ATTACK_BLOCK: {
        id: "attackBlock",
        name: "攻击方块",
        description: "允许在区域内攻击方块",
        category: "交互"
    },
    ATTACK_ENTITY: {
        id: "attackEntity",
        name: "攻击实体",
        description: "允许在区域内攻击实体",
        category: "交互"
    },
    ATTACK_MINECART: {
        id: "attackMinecart",
        name: "攻击矿车",
        description: "允许在区域内攻击矿车",
        category: "交互"
    },
    ATTACK_PLAYER: {
        id: "attackPlayer",
        name: "攻击玩家",
        description: "允许在区域内攻击其他玩家",
        category: "交互"
    },
    ATTACK_ANIMAL: {
        id: "attackAnimal",
        name: "攻击动物",
        description: "允许在区域内攻击动物",
        category: "交互"
    },
    ATTACK_MONSTER: {
        id: "attackMonster",
        name: "攻击怪物",
        description: "允许在区域内攻击怪物",
        category: "交互"
    },
    USE_FISHING_ROD: {
        id: "useFishingRod",
        name: "使用钓鱼竿",
        description: "允许在区域内使用钓鱼竿",
        category: "交互"
    },
    PLACE_MINECART: {
        id: "placeMinecart",
        name: "放置矿车",
        description: "允许在区域内的铁轨上放置矿车",
        category: "交互"
    },
    INTERACT_VILLAGER: {
        id: "interactVillager",
        name: "与村民交互",
        description: "允许在区域内与村民交易或互动",
        category: "交互"
    },
    INTERACT_CHEST_BOAT: {
        id: "interactChestBoat",
        name: "与船箱交互",
        description: "允许在区域内与装有箱子的船交互",
        category: "交互"
    },
    INTERACT_CHEST_MINECART: {
        id: "interactChestMinecart",
        name: "与矿车箱子交互",
        description: "允许在区域内与装有箱子的矿车交互",
        category: "交互"
    },
    RIDE_BOAT: {
        id: "rideBoat",
        name: "乘坐船",
        description: "允许在区域内乘坐船",
        category: "交互"
    },
    RIDE_MINECART: {
        id: "rideMinecart",
        name: "乘坐矿车",
        description: "允许在区域内乘坐矿车",
        category: "交互"
    },
    RIDE_HORSE: {
        id: "rideHorse",
        name: "骑马",
        description: "允许在区域内骑马和其他类似坐骑",
        category: "交互"
    },
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
    ENTER_AREA: {
        id: "enterArea",
        name: "进入区域",
        description: "允许玩家进入此区域",
        category: "移动" // 新增一个移动分类或者放在交互分类
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

// 确保 "移动" 分类存在，如果上面选择了 "移动"
const ensureCategoriesExist = (permissions) => {
    const categories = new Set();
    Object.values(permissions).forEach(p => {
        if (p && p.category) {
            categories.add(p.category);
        }
    });
    // 如果需要，可以在这里添加默认分类，但通常由权限定义驱动
    // console.log("Detected categories:", [...categories]);
};

// 加载权限定义
function loadPermissions() {
    try {
        // 检查 area 目录是否存在，如果不存在则创建
        const areaDir = './plugins/area';
        if (!File.exists(areaDir)) {
            logInfo(`创建目录: ${areaDir}`);
            File.mkdir(areaDir);
        }

        if (!File.exists(PERMISSIONS_PATH)) {
            logInfo(`权限配置文件未找到: ${PERMISSIONS_PATH}`);
            logInfo(`正在创建默认权限配置文件...`);
            // 将 DEFAULT_PERMISSIONS 写入新文件
            try {
                File.writeTo(PERMISSIONS_PATH, JSON.stringify(DEFAULT_PERMISSIONS, null, 2));
                logInfo(`默认权限配置文件已创建: ${PERMISSIONS_PATH}`);
                return DEFAULT_PERMISSIONS; // 返回刚写入的默认权限
            } catch (writeError) {
                 logError(`创建默认权限配置文件失败: ${writeError}`);
                 // 创建失败也返回内存中的默认值
                 logWarning("将使用内存中的默认权限定义。");
                 return DEFAULT_PERMISSIONS;
            }
        }

        const content = File.readFrom(PERMISSIONS_PATH);
        // 检查内容是否有效
        if (content === null || content === undefined || content.trim() === '') {
             logError(`读取权限配置文件内容失败或文件为空: ${PERMISSIONS_PATH}`);
             // 如果文件为空或读取失败，尝试返回默认权限
             logWarning("将尝试使用内存中的默认权限定义。");
             return DEFAULT_PERMISSIONS;
        }

        // 尝试解析 JSON
        let loadedPermissions = JSON.parse(content);
        logInfo("权限定义已从 permissions.json 加载。");

        // --- 开始自动更新逻辑 ---
        let updated = false;
        const defaultKeys = Object.keys(DEFAULT_PERMISSIONS);
        const loadedKeys = Object.keys(loadedPermissions);

        // 检查并添加缺失的权限
        for (const key of defaultKeys) {
            if (!loadedPermissions[key]) {
                logInfo(`发现缺失的权限定义: ${key}，将从默认值添加。`);
                loadedPermissions[key] = DEFAULT_PERMISSIONS[key];
                updated = true;
            }
            /*
            // 可选：检查现有权限的结构是否完整，例如是否缺少 name, description, category
            else if (DEFAULT_PERMISSIONS[key]) {
                const defaultPerm = DEFAULT_PERMISSIONS[key];
                const loadedPerm = loadedPermissions[key];
                let needsUpdate = false;
                if (loadedPerm.name !== defaultPerm.name) {
                    logDebug(`权限 ${key} 的 name 与默认值不同，将更新。`);
                    loadedPerm.name = defaultPerm.name;
                    needsUpdate = true;
                }
                if (loadedPerm.description !== defaultPerm.description) {
                    logDebug(`权限 ${key} 的 description 与默认值不同，将更新。`);
                    loadedPerm.description = defaultPerm.description;
                    needsUpdate = true;
                }
                if (loadedPerm.category !== defaultPerm.category) {
                    logDebug(`权限 ${key} 的 category 与默认值不同，将更新。`);
                    loadedPerm.category = defaultPerm.category;
                    needsUpdate = true;
                }
                 if (loadedPerm.id !== defaultPerm.id) { // 确保 ID 也一致
                    logDebug(`权限 ${key} 的 id 与默认值不同，将更新。`);
                    loadedPerm.id = defaultPerm.id;
                    needsUpdate = true;
                }
                if (needsUpdate) {
                    updated = true;
                }
            }*/
        }

        // 检查并移除不再使用的权限 (可选，如果需要清理)
        /*
        for (const key of loadedKeys) {
            if (!DEFAULT_PERMISSIONS[key]) {
                logInfo(`发现不再使用的权限定义: ${key}，将从配置文件中移除。`);
                delete loadedPermissions[key];
                updated = true;
            }
        }
        */

        // 如果进行了更新，则写回文件
        if (updated) {
            logInfo("权限配置文件已更新，正在保存...");
            try {
                File.writeTo(PERMISSIONS_PATH, JSON.stringify(loadedPermissions, null, 2));
                logInfo(`权限配置文件已更新并保存: ${PERMISSIONS_PATH}`);
            } catch (writeError) {
                logError(`更新权限配置文件失败: ${writeError}`);
                // 即使写回失败，也返回合并后的内存版本
            }
        }
        // --- 结束自动更新逻辑 ---

        return loadedPermissions; // 返回可能已更新的权限对象

    } catch (e) {
        logError(`加载或解析权限配置文件失败: ${e}`);
        // 备份损坏的文件
        if (File.exists(PERMISSIONS_PATH)) {
            const backupPath = `${PERMISSIONS_PATH}.backup.${Date.now()}`;
             try {
                File.copy(PERMISSIONS_PATH, backupPath);
                logInfo(`已将可能损坏的权限配置文件备份至: ${backupPath}`);
             } catch (copyError) {
                logError(`备份权限配置文件失败: ${copyError}`);
             }
        }
        // 在出错时返回内存中的默认权限，以提高容错性
        logWarning("解析配置文件失败，将尝试使用内存中的默认权限定义。");
        return DEFAULT_PERMISSIONS;
    }
}

// 初始化时加载权限
let PERMISSIONS = loadPermissions();
ensureCategoriesExist(PERMISSIONS); // 调用检查函数

// 重新加载权限的函数（如果需要热重载）
function reloadPermissions() {
    PERMISSIONS = loadPermissions();
    ensureCategoriesExist(PERMISSIONS);
    logInfo("权限定义已重新加载。");
    return PERMISSIONS;
}


// 将权限按类别分组
function getPermissionsByCategory() {
    const categories = {};
    if (PERMISSIONS && typeof PERMISSIONS === 'object') {
        for (const key in PERMISSIONS) {
            if (Object.hasOwnProperty.call(PERMISSIONS, key)) {
                const perm = PERMISSIONS[key];
                if (perm && typeof perm === 'object' && perm.category) {
                    if (!categories[perm.category]) {
                        categories[perm.category] = [];
                    }
                    categories[perm.category].push(perm);
                } else {
                    logWarning(`权限注册表中发现无效的权限定义: ${key}`);
                }
            }
        }
    } else {
        logError("无法获取权限分类，因为权限数据未正确加载或格式错误。");
    }
    return categories;
}

// 获取所有权限ID列表
function getAllPermissionIds() {
    if (PERMISSIONS && typeof PERMISSIONS === 'object') {
        return Object.values(PERMISSIONS)
                     .filter(p => p && typeof p === 'object' && p.id)
                     .map(p => p.id);
    } else {
        logError("无法获取权限ID列表，因为权限数据未正确加载或格式错误。");
        return [];
    }
}

// 获取所有权限分类
function getAllCategories() {
    if (PERMISSIONS && typeof PERMISSIONS === 'object') {
        return [...new Set(Object.values(PERMISSIONS)
                                 .filter(p => p && typeof p === 'object' && p.category)
                                 .map(p => p.category))];
    } else {
        logError("无法获取权限分类列表，因为权限数据未正确加载或格式错误。");
        return [];
    }
}

module.exports = {
    PERMISSIONS,
    getPermissionsByCategory,
    getAllPermissionIds,
    getAllCategories,
    loadPermissions, // 导出加载函数
    reloadPermissions // 导出重载函数
};
