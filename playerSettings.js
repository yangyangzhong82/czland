// playerSettings.js
const { getDbSession } = require('./database');
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
    try {
        const db = getDbSession();
        const stmt = db.prepare(`
            SELECT displayActionBar, displayTitle, displayCooldown
            FROM player_settings
            WHERE uuid = ?
        `);
        
        stmt.bind(uuid);
        stmt.execute();
        
        // 如果找到记录，返回设置
        if(stmt.step()) {
            const row = stmt.fetch();
            return {
                displayActionBar: row.displayActionBar === 1,
                displayTitle: row.displayTitle === 1,
                displayCooldown: row.displayCooldown
            };
        }
        
        // 如果没有找到，创建默认设置
        const defaultSettings = {...DEFAULT_SETTINGS};
        updatePlayerSettings(uuid, defaultSettings);
        return defaultSettings;
    } catch(e) {
        logger.error(`获取玩家设置失败: ${e}`);
        return {...DEFAULT_SETTINGS};
    }
}

// 更新玩家设置
function updatePlayerSettings(uuid, newSettings) {
    try {
        const db = getDbSession();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO player_settings (uuid, displayActionBar, displayTitle, displayCooldown)
            VALUES (?, ?, ?, ?)
        `);
        
        // 合并默认设置和新设置
        const settings = {...DEFAULT_SETTINGS, ...newSettings};
        
        stmt.bind([
            uuid,
            settings.displayActionBar ? 1 : 0,
            settings.displayTitle ? 1 : 0,
            settings.displayCooldown || 2000
        ]);
        
        stmt.execute();
        logger.info(`成功更新玩家${uuid}的设置`);
        return true;
    } catch(e) {
        logger.error(`更新玩家设置失败: ${e}`);
        return false;
    }
}


module.exports = {
    getPlayerSettings,
    updatePlayerSettings,
    DEFAULT_SETTINGS
};