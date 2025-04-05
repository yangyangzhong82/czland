// logger.js
let isDebugEnabled = false; // Module-level flag for debug status

// Function to initialize the logger, typically called once after config is loaded
function initLogger(config) {
    isDebugEnabled = config && config.debug === true;
    logInfo(`Logger initialized. Debug mode: ${isDebugEnabled}`);
}

// 创建日志函数
function logDebug(message) {
    // 只检查模块级别的标志
    if (isDebugEnabled) {
        logger.info(`[czland] [DEBUG] ${message}`); // 使用 logger.info 打印调试信息，或根据需要调整级别
    }
}

function logInfo(message) {
    logger.info(`[czland] ${message}`);
}

function logWarning(message) {
    logger.warn(`[czland] ${message}`);
}

function logError(message, stack = null) { // 允许传入堆栈信息
    let logMessage = `[czland] [ERROR] ${message}`;
    if (stack) {
        logMessage += `\nStack Trace:\n${stack}`;
    }
    logger.error(logMessage);
}

// 移除 updateConfig 函数

module.exports = {
    initLogger, // 导出初始化函数
    logDebug,
    logInfo,
    logWarning,
    logError
};
