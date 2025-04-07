// configManager.js
const CONFIG_PATH = './plugins/area/config.json';
const CURRENT_VERSION = "1.6.5";
const { logInfo, logError, logDebug } = require('./logger'); // 确保引入 logger

const DEFAULT_CONFIG = {
    version: CURRENT_VERSION,
    spatialIndex: {
        chunkSize: 16  // 默认区块大小
    },
    // 旧的可视化配置，保留用于兼容或未来可能的其他可视化
    /*
    visualization: {
        enabled: true, // 这个可以考虑是否保留，或者合并到 bsci.enabled
        duration: 30,          // 显示时间，单位为秒
        color: {
            r: 0,              // 红色分量
            g: 191,            // 绿色分量
            b: 255,            // 蓝色分量
            a: 255             // 透明度
        },
        thickness: 1.5         // 线条粗细
    },
    */
    // 新增 BSCI 专用配置
    bsci: {
        enabled: true,         // BSCI 功能总开关
        duration: 30,          // 显示时间，单位为秒
        thickness: 1.5,        // 线条粗细
        mainAreaColor: {       // 主区域轮廓颜色
            r: 0,
            g: 191,
            b: 255,
            a: 255
        },
        subAreaColor: {        // 子区域轮廓颜色
            r: 255,
            g: 165,
            b: 0,
            a: 255
        },
        subAreaLevel2Color: {  // 新增：二级子区域轮廓颜色
            r: 148,
            g: 0,
            b: 211,
            a: 255
        },
        selectionPointColor: { // 选点时显示的颜色
            r: 0,
            g: 255,
            b: 0,
            a: 255
        }
    },
    teleport: {
        enabled: true, // 是否启用区域传送功能
        costPerTeleport: 10, // 每次传送的固定费用
        teleportCooldown: 5, // 玩家每次传送的冷却时间（秒），0 或负数表示无冷却
        preventTeleportIfInside: true, // 是否阻止玩家传送到他们当前所在的区域
        economy: { // 传送使用的独立经济配置
            enabled: true, // 是否对传送收费 
            type: "money", // 经济类型: "money", "scoreboard", "czmoney"
            scoreboardObjective: "teleport_cost" // 当type为"scoreboard"时使用的计分板名称
        }
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
        bucket: [
            "minecraft:bucket",
            "minecraft:water_bucket",
            "minecraft:lava_bucket",
            "minecraft:powder_snow_bucket"
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
        minecarts: [ // 这个似乎重复了，保留上面的 itemTypes.minecart 和 entityTypes.minecarts
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
    maxTotalAreaSizePerPlayer: -1, // 玩家可拥有的区域总大小限制 (-1 为不限制)
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

// --- Iterative Merge Function ---
function mergeConfigIterative(target, source) {
    const stack = [{ target, source }];
    const mergedObjects = new Map(); // Track merged objects to handle potential cycles (though unlikely in JSON)

    // Deep clone the initial target to avoid modifying the original userConfig directly during the process
    const result = JSON.parse(JSON.stringify(target));
    stack[0].target = result; // Update stack entry to point to the cloned target

    while (stack.length > 0) {
        const { target: currentTarget, source: currentSource } = stack.pop();

        // Avoid re-processing the same object pair if encountered via cycles/duplicates
        if (mergedObjects.has(currentTarget) && mergedObjects.get(currentTarget) === currentSource) {
            continue;
        }
        mergedObjects.set(currentTarget, currentSource);


        for (const key in currentSource) {
            if (Object.prototype.hasOwnProperty.call(currentSource, key)) {
                const sourceValue = currentSource[key];
                const targetValue = currentTarget[key];

                if (
                    typeof sourceValue === 'object' &&
                    sourceValue !== null &&
                    !Array.isArray(sourceValue) &&
                    typeof targetValue === 'object' && // Check if target also has an object for this key
                    targetValue !== null &&
                    !Array.isArray(targetValue)
                ) {
                    // If both are objects, push them onto the stack for later merging
                    // Ensure the target object exists if it doesn't
                     if (!(key in currentTarget)) {
                         currentTarget[key] = {}; // Create object in target if missing
                     }
                    stack.push({ target: currentTarget[key], source: sourceValue });
                } else if (!(key in currentTarget)) {
                    // If the key doesn't exist in the target, add it from the source
                    // Deep clone source value if it's an object/array to prevent shared references
                     try {
                        currentTarget[key] = JSON.parse(JSON.stringify(sourceValue));
                     } catch (e) {
                         logError(`Error cloning value for key "${key}": ${e.message}`);
                         currentTarget[key] = sourceValue; // Fallback to shallow copy on error
                     }
                }
                // If the key exists in the target and is not an object to be merged,
                // the target's value is kept (user's value overrides default unless it's a structure mismatch handled above)
            }
        }
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
        logInfo("区域保护系统: 已创建默认配置文件");
        return DEFAULT_CONFIG;
    }

    try {
        const content = File.readFrom(CONFIG_PATH);
        let userConfig = JSON.parse(content);

        // 检查版本并合并更新
        if (!userConfig.version || userConfig.version !== CURRENT_VERSION) {
            logInfo(`区域保护系统: 配置文件版本不匹配或缺失 (用户版本: ${userConfig.version || '未知'}, 当前版本: ${CURRENT_VERSION})`);
            logInfo("区域保护系统: 正在合并和更新配置文件...");

            // 合并配置，保留用户设置，添加新默认值 (使用迭代版本)
            const updatedConfig = mergeConfigIterative(userConfig, DEFAULT_CONFIG);
            // 强制更新版本号
            updatedConfig.version = CURRENT_VERSION;

            // 保存更新后的配置
            saveConfig(updatedConfig);
            logInfo("区域保护系统: 配置文件已更新至最新版本");

            return updatedConfig; // 返回更新后的配置
        } else {
            // 版本匹配，仍然进行一次合并以确保所有默认键都存在（防止手动删除或结构变更） (使用迭代版本)
            // 这次合并基于用户当前的配置 userConfig
            const mergedConfig = mergeConfigIterative(userConfig, DEFAULT_CONFIG);

            // 检查合并后的配置是否与原始用户配置不同 (使用迭代合并后的结果)
            // 使用简单的比较可能不够，因为对象顺序可能变化，但对于补充缺失键是有效的
            // 注意：深比较 JSON 字符串可能因键顺序不同而误判，但这里主要目的是捕捉是否补充了键
            let configChanged = false;
            try {
                if (JSON.stringify(mergedConfig) !== JSON.stringify(userConfig)) {
                    configChanged = true;
                }
            } catch (stringifyError) {
                // 如果序列化失败（例如循环引用，虽然不太可能），也标记为已更改以尝试保存
                logError(`序列化配置时出错: ${stringifyError.message}`);
                configChanged = true; // 尝试保存修复后的版本
            }


            if (configChanged) {
                 // logDebug("区域保护系统: 配置文件结构与默认值存在差异或缺少键，已合并/补充。正在保存..."); // 移除此处的 logDebug 调用
                 logInfo("区域保护系统: 配置文件结构已与默认值合并/补充。正在保存..."); // 可以用 logInfo 替代，如果需要日志的话
                 saveConfig(mergedConfig); // 保存合并后的版本
            }

            return mergedConfig; // 返回最终的、确保结构完整的配置
        }

    } catch (e) {
        // 捕获加载、解析或合并过程中的任何错误
        logError(`配置文件处理失败: ${e.message}`, e.stack);
        // 备份损坏的配置文件
        if (File.exists(CONFIG_PATH)) {
            const backupPath = `${CONFIG_PATH}.backup.${Date.now()}`;
            try {
                File.copy(CONFIG_PATH, backupPath);
                logInfo(`已将损坏的配置文件备份至: ${backupPath}`);
            } catch (copyError) {
                logError(`备份损坏的配置文件失败: ${copyError.message}`);
            }
        }
        // 使用默认配置并保存
        logInfo("区域保护系统: 使用默认配置。");
        saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
    }
}

// 保存配置
function saveConfig(config) {
    try {
        return File.writeTo(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (e) {
        logError(`配置文件保存失败: ${e.message}`, e.stack);
        return false;
    }
}


module.exports = {
    loadConfig,
    saveConfig
};
