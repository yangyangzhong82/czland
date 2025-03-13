// configManager.js
const CONFIG_PATH = './plugins/area/config.json';
const DEFAULT_CONFIG = {
    version: "1.0.0",
    shulkerBoxTypes: [
        "minecraft:shulker_box",
        "minecraft:undyed_shulker_box"
    ],
    anvilTypes: [
        "minecraft:anvil",
        "minecraft:chipped_anvil",
        "minecraft:damaged_anvil"
    ],
    debug: false,
    defaultGroup: "visitor",
    displayAreaInfo: true,
    areaInfoDisplayDuration: 5,
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

// 加载配置
function loadConfig() {
    if (!File.exists(CONFIG_PATH)) {
        // 如果配置不存在,创建默认配置
        saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
    }

    try {
        const content = File.readFrom(CONFIG_PATH);
        return JSON.parse(content);
    } catch (e) {
        logger.error(`配置文件读取失败: ${e}`);
        return DEFAULT_CONFIG;
    }
}

// 保存配置
function saveConfig(config) {
    const dir = './plugins/area';
    if (!File.exists(dir)) {
        File.mkdir(dir);
    }
    return File.writeTo(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = {
    loadConfig,
    saveConfig
};