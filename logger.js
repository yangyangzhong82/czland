// logger.js
const { loadConfig } = require('./configManager');
const config = loadConfig();






// 创建日志函数
function logDebug(message) {
    if (config.debug) {
        logger.info(`[czland] ${message}`);
    }
}

function logInfo(message) {
    logger.info(`[czland] ${message}`);
}

function logWarning(message) {
    logger.warn(`[czland] ${message}`);
}

function logError(message) {
    logger.error(`[czland] ${message}`);
}

// 更新配置（当配置更改时调用）
function updateConfig(newConfig) {
    config = newConfig;
}

module.exports = {
    logDebug,
    logInfo,
    logWarning,
    logError,
    updateConfig
};