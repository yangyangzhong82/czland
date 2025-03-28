// configManager.js
const CONFIG_PATH = './plugins/area/config.json';
const CURRENT_VERSION = "1.6.3";
const DEFAULT_CONFIG = {
    version: CURRENT_VERSION,
    spatialIndex: {
        chunkSize: 16  // 默认区块大小
    },
    visualization: {
        enabled: true,
        duration: 30,          // 显示时间，单位为秒
        color: {
            r: 0,              // 红色分量
            g: 191,            // 绿色分量
            b: 255,            // 蓝色分量
            a: 255             // 透明度
        },
        thickness: 1.5         // 线条粗细
    },
    shulkerBoxTypes: [
        "minecraft:shulker_box",
        "minecraft:undyed_shulker_box"
    ],
    anvilTypes: [
        "minecraft:anvil",
        "minecraft:chipped_anvil",
        "minecraft:damaged_anvil"
    ],
    itemTypes: {
        minecart: [
            "minecraft:minecart", 
            "minecraft:chest_minecart", 
            "minecraft:hopper_minecart", 
            "minecraft:tnt_minecart", 
            "minecraft:command_block_minecart"
        ],
        shovel: [
            "minecraft:wooden_shovel",
            "minecraft:stone_shovel",
            "minecraft:iron_shovel",
            "minecraft:golden_shovel",
            "minecraft:diamond_shovel",
            "minecraft:netherite_shovel"
        ],
        axe: [
            "minecraft:wooden_axe",
            "minecraft:stone_axe",
            "minecraft:iron_axe",
            "minecraft:golden_axe",
            "minecraft:diamond_axe",
            "minecraft:netherite_axe"
        ],
        hoe: [
            "minecraft:wooden_hoe",
            "minecraft:stone_hoe",
            "minecraft:iron_hoe",
            "minecraft:golden_hoe",
            "minecraft:diamond_hoe",
            "minecraft:netherite_hoe"
        ],
        bow: ["minecraft:bow"],
        crossbow: ["minecraft:crossbow"],
        trident: ["minecraft:trident"],
        potion: ["minecraft:potion"],
        splashPotion: ["minecraft:splash_potion"],
        lingeringPotion: ["minecraft:lingering_potion"],
        expBottle: ["minecraft:experience_bottle"],
        fishingRod: ["minecraft:fishing_rod"]
    },
    blockTypes: {
        daylightDetector: ["minecraft:daylight_detector"],
        rails: [
            "minecraft:rail", 
            "minecraft:golden_rail", 
            "minecraft:detector_rail", 
            "minecraft:activator_rail"
        ],
        cauldron: [
            "minecraft:cauldron",
            "minecraft:water_cauldron",
            "minecraft:lava_cauldron",
            "minecraft:powder_snow_cauldron"
        ],
        comparator: ["minecraft:comparator"],
        repeater: ["minecraft:repeater"],
        noteblock: ["minecraft:note_block"],
        jukebox: ["minecraft:jukebox"],
        button: [
            /minecraft:.*_button/
        ],
        lever: ["minecraft:lever"],
        composter: ["minecraft:composter"],
        door: [
            /minecraft:.*_door/
        ],
        trapdoor: [
            /minecraft:.*_trapdoor/
        ],
        fenceGate: [
            /minecraft:.*_fence_gate/
        ],
        campfire: [
            "minecraft:campfire",
            "minecraft:soul_campfire"
        ],
        beehive: [
            "minecraft:beehive",
            "minecraft:bee_nest"
        ],
        bookshelf: ["minecraft:chiseled_bookshelf"],
        suspiciousBlock: [
            "minecraft:suspicious_sand",
            "minecraft:suspicious_gravel"
        ],
        respawnAnchor: ["minecraft:respawn_anchor"],
        candle: [
            /minecraft:.*candle/
        ],
        sign: [
            /minecraft:.*_sign/,
            /minecraft:.*_hanging_sign/
        ],
        dragonEgg: ["minecraft:dragon_egg"],
        shovelable: [
            "minecraft:grass_block",
            "minecraft:dirt",
            "minecraft:podzol",
            "minecraft:mycelium"
        ],
        axeable: [
            /minecraft:.*_log/,
            /minecraft:.*_wood/,
            "minecraft:hay_block"
        ],
        hoeable: [
            "minecraft:grass_block",
            "minecraft:dirt",
            "minecraft:grass_path",
            "minecraft:coarse_dirt"
        ]
    },
    entityTypes: {
        villagers: [
            "minecraft:villager", 
            "minecraft:villager_v2", 
            "minecraft:zombie_villager", 
            "minecraft:zombie_villager_v2"],
        chestBoats: [
            "minecraft:chest_boat", 
            "minecraft:chest_raft"], // 示例
        chestMinecarts: [
            "minecraft:chest_minecart"
        ],
        boats: [
            "minecraft:boat", 
            "minecraft:chest_boat", 
            "minecraft:raft", 
            "minecraft:chest_raft"], // 包含带箱子的
        minecarts: [
            "minecraft:minecart", 
            "minecraft:chest_minecart", 
            "minecraft:hopper_minecart", 
            "minecraft:tnt_minecart", 
            "minecraft:command_block_minecart"], // 包含带箱子的等
        horses: [
            "minecraft:horse", 
            "minecraft:donkey", 
            "minecraft:mule", 
            "minecraft:skeleton_horse", 
            "minecraft:zombie_horse", 
            "minecraft:camel", 
            "minecraft:llama", 
            "minecraft:trader_llama", 
            "minecraft:pig", 
            "minecraft:strider"
        ], // 包含其他类似坐骑
        animals: [
            "minecraft:chicken", "minecraft:cow", "minecraft:pig", "minecraft:sheep",
            "minecraft:wolf", "minecraft:villager", "minecraft:mooshroom", "minecraft:squid",
            "minecraft:rabbit", "minecraft:bat", "minecraft:iron_golem", "minecraft:snow_golem",
            "minecraft:ocelot", "minecraft:horse", "minecraft:donkey", "minecraft:mule",
            "minecraft:polar_bear", "minecraft:llama", "minecraft:parrot", "minecraft:dolphin",
            "minecraft:turtle", "minecraft:panda", "minecraft:fox", "minecraft:bee",
            "minecraft:strider", "minecraft:goat", "minecraft:axolotl", "minecraft:glow_squid",
            "minecraft:cat", "minecraft:frog", "minecraft:allay", "minecraft:camel",
            "minecraft:trader_llama", "minecraft:tropical_fish", "minecraft:pufferfish",
            "minecraft:salmon", "minecraft:cod", "minecraft:tadpole", "minecraft:sniffer"
        ],
        monsters: [
            "minecraft:zombie", "minecraft:skeleton", "minecraft:creeper", "minecraft:spider",
            "minecraft:enderman", "minecraft:witch", "minecraft:slime", "minecraft:ghast",
            "minecraft:magma_cube", "minecraft:blaze", "minecraft:zombie_pigman", "minecraft:piglin",
            "minecraft:zombified_piglin", "minecraft:wither_skeleton", "minecraft:guardian",
            "minecraft:elder_guardian", "minecraft:shulker", "minecraft:husk", "minecraft:stray",
            "minecraft:phantom", "minecraft:drowned", "minecraft:pillager", "minecraft:ravager",
            "minecraft:vindicator", "minecraft:evoker", "minecraft:vex", "minecraft:hoglin",
            "minecraft:zoglin", "minecraft:piglin_brute", "minecraft:warden", "minecraft:wither",
            "minecraft:ender_dragon", "minecraft:cave_spider", "minecraft:silverfish",
            "minecraft:endermite", "minecraft:evoker_fangs"
        ],
        minecarts: [
            "minecraft:minecart", "minecraft:chest_minecart", "minecraft:hopper_minecart",
            "minecraft:tnt_minecart", "minecraft:command_block_minecart"
        ],
        vehicles: [
            "minecraft:boat", "minecraft:chest_boat"
        ]
    },    
    debug: true,
    toolSelector: {
        enabled: false,
        tool: "minecraft:stick",  // Default tool is a stick, null would disable

    },
    displayAreaInfo: true,
    areaInfoDisplayDuration: 5,
    maxAreasPerPlayer: 5,
    // defaultGroup: "visitor", // 移除此行，不再使用单一的默认组名
    defaultGroupPermissions: [
        "break",
        "place",
        "pickupItems",
        "dropItems",
        "openContainer"
    ],
    economy: {
        enabled: true, // 是否启用经济系统
        type: "money", // 经济类型: "money" 或 "scoreboard"
        scoreboardObjective: "money", // 当type为"scoreboard"时使用的计分板名称
        pricePerBlock: 1, // 每个方块的基础价格
        priceByVolume: true, // 是否按体积计算价格
        priceByDimension: { // 按维度设置价格倍率
            overworld: 1,
            nether: 1.5, 
            end: 2
        },
        minPrice: 100, // 最低价格
        maxPrice: 1000000, // 最高价格
        refundRate: 0.7, // 退款率(0-1之间)
        priceFormula: {
            useCustom: false, // 是否使用自定义公式
            formula: "length * width * height * pricePerBlock" // 自定义价格计算公式
        }
    },
    areaSizeLimits: {
        enabled: true,
        min: {
            x: 1,       // X轴最小长度
            y: 1,       // Y轴最小高度
            z: 1,       // Z轴最小宽度
            volume: 10  // 最小体积
        },
        max: {
            x: 200,     // X轴最大长度
            y: 128,     // Y轴最大高度
            z: 200,     // Z轴最大宽度
            volume: 1000000 // 最大体积
        },
        // 子区域单独配置（如果为null则使用主区域配置）
        subarea: {
            enabled: true,
            min: null,  // 为null时使用主区域配置
            max: null   // 为null时使用主区域配置
        }
    }

};

function mergeConfig(userConfig, defaultConfig) {
    const result = { ...userConfig };
    
    for (const key in defaultConfig) {
        // 如果用户配置中没有该键，直接使用默认值
        if (!(key in result)) {
            result[key] = defaultConfig[key];
            continue;
        }
        
        // 如果两者都是对象且不是数组，递归合并
        if (
            typeof defaultConfig[key] === 'object' && 
            defaultConfig[key] !== null && 
            !Array.isArray(defaultConfig[key]) &&
            typeof result[key] === 'object' && 
            result[key] !== null && 
            !Array.isArray(result[key])
        ) {
            result[key] = mergeConfig(result[key], defaultConfig[key]);
        }
        // 否则保留用户配置
    }
    
    return result;
}
// 加载配置
function loadConfig() {
    const dir = './plugins/area';
    if (!File.exists(dir)) {
        File.mkdir(dir);
    }
    
    if (!File.exists(CONFIG_PATH)) {
        // 如果配置不存在,创建默认配置
        saveConfig(DEFAULT_CONFIG);
        logger.info("区域保护系统: 已创建默认配置文件");
        return DEFAULT_CONFIG;
    }

    try {
        const content = File.readFrom(CONFIG_PATH);
        let userConfig = JSON.parse(content);
        
        // 检查版本
        if (userConfig.version !== CURRENT_VERSION) {
            logger.info(`区域保护系统: 配置文件版本不匹配 (用户版本: ${userConfig.version || '未知'}, 当前版本: ${CURRENT_VERSION})`);
            logger.info("区域保护系统: 正在更新配置文件...");
            
            // 合并配置
            const updatedConfig = mergeConfig(userConfig, DEFAULT_CONFIG);
            // 更新版本号
            updatedConfig.version = CURRENT_VERSION;
            
            // 保存更新后的配置
            saveConfig(updatedConfig);
            logger.info("区域保护系统: 配置文件已更新至最新版本");
            
            return updatedConfig;
        }
        
        return userConfig;
    } catch (e) {
        logger.error(`配置文件读取失败: ${e}`);
        // 备份损坏的配置文件
        if (File.exists(CONFIG_PATH)) {
            const backupPath = `${CONFIG_PATH}.backup.${Date.now()}`;
            File.copy(CONFIG_PATH, backupPath);
            logger.info(`已将损坏的配置文件备份至: ${backupPath}`);
        }
        // 使用默认配置
        saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
    }
}

// 保存配置
function saveConfig(config) {
    try {
        return File.writeTo(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (e) {
        logger.error(`配置文件保存失败: ${e}`);
        return false;
    }
}


module.exports = {
    loadConfig,
    saveConfig
};
