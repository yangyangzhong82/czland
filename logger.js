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
        logger.info(` [DEBUG] ${message}`); 
    }
}

function logInfo(message) {
    logger.info(` ${message}`);
}

function logWarning(message) {
    logger.warn(` ${message}`);
}

function logError(message, stack = null) { // 允许传入堆栈信息
    let logMessage = ` [ERROR] ${message}`;
    if (stack) {
        logMessage += `\nStack Trace:\n${stack}`;
    }
    logger.error(logMessage);
}


module.exports = {
    initLogger, // 导出初始化函数
    logDebug,
    logInfo,
    logWarning,
    logError
};
