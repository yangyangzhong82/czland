// configManager.js
const CONFIG_PATH = './plugins/area/config.json';
const CURRENT_VERSION = "1.1.0";
const DEFAULT_CONFIG = {
    version: CURRENT_VERSION,
    shulkerBoxTypes: [
        "minecraft:shulker_box",
        "minecraft:undyed_shulker_box"
    ],
    anvilTypes: [
        "minecraft:anvil",
        "minecraft:chipped_anvil",
        "minecraft:damaged_anvil"
    ],
    debug: true,
    defaultGroup: "visitor",
    displayAreaInfo: true,
    areaInfoDisplayDuration: 5,
    maxAreasPerPlayer: 5,
    defaultGroup: "visitor",
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