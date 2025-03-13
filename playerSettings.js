// playerSettings.js
const SETTINGS_PATH = './plugins/area/playerSettings.json';
const DEFAULT_SETTINGS = {
    displayActionBar: true,    // 是否显示ActionBar
    displayTitle: true,        // 是否显示标题
    displayCooldown: 2000,     // 切换区域显示冷却时间(毫秒)
};

// 加载玩家设置
function loadPlayerSettings() {
    if (File.exists(SETTINGS_PATH)) {
        try {
            return JSON.parse(File.readFrom(SETTINGS_PATH)) || {};
        } catch(e) {
            return {};
        }
    }
    return {};
}

// 保存玩家设置
function savePlayerSettings(settings) {
    let dir = './plugins/area';
    if (!File.exists(dir)) {
        File.mkdir(dir);
    }
    return File.writeTo(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// 获取玩家设置
function getPlayerSettings(uuid) {
    const settings = loadPlayerSettings();
    if (!settings[uuid]) {
        settings[uuid] = {...DEFAULT_SETTINGS};
        savePlayerSettings(settings);
    }
    return settings[uuid];
}

// 更新玩家设置
function updatePlayerSettings(uuid, newSettings) {
    const settings = loadPlayerSettings();
    settings[uuid] = {...DEFAULT_SETTINGS, ...newSettings};
    return savePlayerSettings(settings);
}

module.exports = {
    getPlayerSettings,
    updatePlayerSettings,
    DEFAULT_SETTINGS
};