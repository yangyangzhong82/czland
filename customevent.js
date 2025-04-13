const iListenAttentively = require('../iListenAttentively-LseExport/lib/iListenAttentively.js');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
mc.listen("onServerStarted", () => {
    
    try {
            
        const enterEventName = "czareaprotection::playerEnterArea";
        const leaveEventName = "czareaprotection::playerLeaveArea";

        if (!iListenAttentively.hasEvent(enterEventName)) {
            if (iListenAttentively.RegisterEvent(enterEventName,"czareaprotection")) {
                logDebug(`自定义事件 "${enterEventName}" 注册成功`);
            } else {
                logger.warn(`尝试注册新事件 "${enterEventName}" 失败`);
            }
        } else {
            logger.warn(`自定义事件 "${enterEventName}" 已存在，跳过注册`);
        }

        if (!iListenAttentively.hasEvent(leaveEventName)) {
            if (iListenAttentively.RegisterEvent(leaveEventName,"czareaprotection")) {
                logDebug(`自定义事件 "${leaveEventName}" 注册成功`);
            } else {
                logger.warn(`尝试注册新事件 "${leaveEventName}" 失败`);
            }
        } else {
            logger.warn(`自定义事件 "${leaveEventName}" 已存在，跳过注册`);
        }
    } catch (e) {
        logger.warn(`检查或注册自定义区域事件时出错: ${e.message}`);
    }
    const allEvents = iListenAttentively.getAllEvent();
    const name = iListenAttentively.getPluginName();
    iListenAttentively.emplaceListener(
        "czareaprotection::playerEnterArea",
        event => {
            logDebug(event.toSNBT());
                 
        
        },
        iListenAttentively.EventPriority.Normal
    );
    iListenAttentively.emplaceListener(
        "czareaprotection::playerLeaveArea",
        event => {
            logDebug(event.toSNBT());
                 
        
        },
        iListenAttentively.EventPriority.Normal
    );
    
    // 在控制台输出所有事件信息
    logDebug(name);
    logDebug("=== 所有已注册的事件 ===");
    allEvents.forEach(event => {
        logDebug(`事件名: ${event.eventName}`);
        logDebug(`所属模组: ${event.modName}`);
        logDebug("-------------------");
    });
})