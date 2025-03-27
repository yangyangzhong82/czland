// playerSettings.js
const { getDbSession } = require('./database');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
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
    if (typeof uuid !== 'string' || uuid === '') {
         logger.warn("尝试获取无效 UUID 的玩家设置");
         return {...DEFAULT_SETTINGS}; // Return default for invalid UUID
    }
    try {
        const db = getDbSession();
        // Prepare statement for efficiency
        const stmt = db.prepare(`
            SELECT displayActionBar, displayTitle, displayCooldown
            FROM player_settings
            WHERE uuid = ?
        `);

        stmt.bind(uuid);
        // stmt.execute(); // Might not be needed before step() for SELECT

        // 如果找到记录，返回设置
        if(stmt.step()) { // Check if a row exists
            const row = stmt.fetch();
            // stmt.reset(); // Reset after fetching
            return {
                // Ensure boolean conversion and provide defaults if DB value is null/unexpected
                displayActionBar: row.displayActionBar === 1,
                displayTitle: row.displayTitle === 1,
                displayCooldown: typeof row.displayCooldown === 'number' ? row.displayCooldown : DEFAULT_SETTINGS.displayCooldown
            };
        }
        // stmt.reset(); // Reset even if no row found

        // 如果没有找到，创建默认设置并返回
        logDebug(`未找到玩家 ${uuid} 的设置，将创建并使用默认设置`);
        const defaultSettings = {...DEFAULT_SETTINGS};
        // Attempt to save the default settings for this new player
        if (!updatePlayerSettings(uuid, defaultSettings)) {
             logger.warn(`为玩家 ${uuid} 创建默认设置时失败 (但不影响本次返回默认值)`);
        }
        return defaultSettings; // Return the defaults immediately

    } catch(e) {
        logger.error(`获取玩家 ${uuid} 设置失败: ${e}`, e.stack);
        return {...DEFAULT_SETTINGS}; // Return default on error
    } finally {
         // Finalize/reset statement if needed
    }
}

// 更新玩家设置 (in DB)
function updatePlayerSettings(uuid, newSettings) {
     if (typeof uuid !== 'string' || uuid === '') {
          logger.error("更新玩家设置失败：无效的 UUID");
          return false;
     }
     if (!newSettings || typeof newSettings !== 'object') {
          logger.error(`更新玩家 ${uuid} 设置失败：无效的设置对象`);
          return false;
     }

    try {
        const db = getDbSession();
        // Use INSERT OR REPLACE for simplicity (creates if not exists, updates if exists)
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO player_settings (uuid, displayActionBar, displayTitle, displayCooldown)
            VALUES (?, ?, ?, ?)
        `);

        // Merge provided settings with defaults to ensure all columns are set
        const settingsToSave = {...DEFAULT_SETTINGS, ...newSettings};

        // Validate and sanitize values before binding
        const displayActionBar = typeof settingsToSave.displayActionBar === 'boolean' ? settingsToSave.displayActionBar : DEFAULT_SETTINGS.displayActionBar;
        const displayTitle = typeof settingsToSave.displayTitle === 'boolean' ? settingsToSave.displayTitle : DEFAULT_SETTINGS.displayTitle;
        const displayCooldown = typeof settingsToSave.displayCooldown === 'number' && settingsToSave.displayCooldown >= 0 ? settingsToSave.displayCooldown : DEFAULT_SETTINGS.displayCooldown;


        stmt.bind([
            uuid,
            displayActionBar ? 1 : 0, // Convert boolean to integer for DB
            displayTitle ? 1 : 0,
            displayCooldown
        ]);

        stmt.execute();
        // stmt.reset(); // Reset if reusing statement object

        // logDebug(`成功更新玩家 ${uuid} 的设置`); // Reduce log noise unless needed
        return true;
    } catch(e) {
        logger.error(`更新玩家 ${uuid} 设置失败: ${e}`, e.stack);
        return false;
    }
}


module.exports = {
    getPlayerSettings,
    updatePlayerSettings,
    DEFAULT_SETTINGS
};