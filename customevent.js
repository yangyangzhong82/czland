const iListenAttentively = require('../iListenAttentively-LseExport/lib/iListenAttentively.js');
mc.listen("onServerStarted", () => {
    
    try {
            
        const enterEventName = "czareaprotection::playerEnterArea";
        const leaveEventName = "czareaprotection::playerLeaveArea";

        if (!iListenAttentively.hasEvent(enterEventName)) {
            if (iListenAttentively.RegisterEvent(enterEventName,"czareaprotection")) {
                logger.warn(`自定义事件 "${enterEventName}" 注册成功`);
            } else {
                logger.warn(`尝试注册新事件 "${enterEventName}" 失败`);
            }
        } else {
            logger.warn(`自定义事件 "${enterEventName}" 已存在，跳过注册`);
        }

        if (!iListenAttentively.hasEvent(leaveEventName)) {
            if (iListenAttentively.RegisterEvent(leaveEventName,"czareaprotection")) {
                logger.warn(`自定义事件 "${leaveEventName}" 注册成功`);
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
            logger.warn(event.toSNBT());
                 
        
        },
        iListenAttentively.EventPriority.Normal
    );
    iListenAttentively.emplaceListener(
        "czareaprotection::playerLeaveArea",
        event => {
            logger.warn(event.toSNBT());
                 
        
        },
        iListenAttentively.EventPriority.Normal
    );
    
    // 在控制台输出所有事件信息
    logger.info(name);
    logger.info("=== 所有已注册的事件 ===");
    allEvents.forEach(event => {
        logger.info(`事件名: ${event.eventName}`);
        logger.info(`所属模组: ${event.modName}`);
        logger.info("-------------------");
    });
})