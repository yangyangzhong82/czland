// economy.js
const { loadConfig } = require('./configManager');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
let czmoneyAddMoney, czmoneyGetMoney, czmoneyReduceMoney, czmoneySetMoney;
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
try {
    czmoneyAddMoney = ll.imports("CzMoney", "addMoney");
    czmoneyGetMoney = ll.imports("CzMoney", "getMoney");
    czmoneyReduceMoney = ll.imports("CzMoney", "reduceMoney");
    czmoneySetMoney = ll.imports("CzMoney", "setMoney");
    //logInfo("成功导入 CzMoney 经济系统");
} catch (e) {
    //logError("导入 CzMoney 经济系统失败: " + e);
}
// 计算区域价格
function calculateAreaPrice(point1, point2) {
    const config = loadConfig().economy;
    if(!config.enabled) return 0;
    
    // 计算区域尺寸
    const length = Math.abs(point2.x - point1.x) + 1;
    const width = Math.abs(point2.z - point1.z) + 1;
    const height = Math.abs(point2.y - point1.y) + 1;
    const volume = length * width * height;
    
    let price;
    if(config.priceFormula.useCustom) {
        try {
            // 使用正则表达式替换所有变量，并确保变量边界
            let formula = config.priceFormula.formula;
            formula = formula.replace(/\blength\b/g, length);
            formula = formula.replace(/\bwidth\b/g, width);
            formula = formula.replace(/\bheight\b/g, height);
            formula = formula.replace(/\bvolume\b/g, volume);
            formula = formula.replace(/\bpricePerBlock\b/g, config.pricePerBlock);
            
            // 添加调试日志
            logDebug(`计算价格使用公式: ${formula}`);
            
            price = eval(formula);
            
            // 确保结果是有效数字
            if (typeof price !== 'number' || isNaN(price)) {
                throw new Error('公式计算结果不是有效数字');
            }
        } catch(e) {
            logError(`价格计算公式错误: ${e}`);
            price = config.priceByVolume ? 
                volume * config.pricePerBlock :
                (length + width + height) * config.pricePerBlock;
        }
    }else {
        // 添加这个 else 块来处理非自定义公式的情况
        price = config.priceByVolume ? 
            volume * config.pricePerBlock :
            (length + width + height) * config.pricePerBlock;
    }
    
    // 应用维度倍率
    const dimMultiplier = config.priceByDimension[getDimensionName(point1.dimid)] || 1;
    price *= dimMultiplier;
    
    // 限制价格范围
    price = Math.max(config.minPrice, Math.min(config.maxPrice, price));
    
    return Math.floor(price);
}

// 获取玩家余额
function getPlayerBalance(player, config) {
    if (config.type === "scoreboard") {
        // 使用计分板API获取玩家余额
        const objective = mc.getScoreObjective(config.scoreboardObjective);
        if (!objective) {
            logger.error(`计分板 ${config.scoreboardObjective} 不存在！`);
            return 0;
        }
        return objective.getScore(player);
    } else if (config.type === "czmoney") {
        // 使用 CzMoney API
        if (!czmoneyGetMoney) {
            logger.error("CzMoney 插件未加载或未导入成功！");
            return 0;
        }
        return czmoneyGetMoney(player.xuid);
    } else {
        // 使用默认money API
        return money.get(player.xuid);
    }
}

// 增加玩家余额 (修改为接受 identifier: uuid 或 xuid)
function addPlayerBalance(identifier, amount, config) {
    if (config.type === "scoreboard") {
        const objective = mc.getScoreObjective(config.scoreboardObjective);
        if (!objective) {
            logError(`计分板目标 "${config.scoreboardObjective}" 不存在！无法增加分数。`);
            return false;
        }

        // 检查传入的 identifier 是否为有效的非空字符串 (UUID)
        if (typeof identifier !== 'string' || identifier.trim() === '') {
            logError(`[addPlayerBalance - Scoreboard] 提供的 identifier 无效或为空: "${identifier}"。无法为计分板增加分数。`);
            return false;
        }

        // 添加更详细的调试日志
        logDebug(`[addPlayerBalance - Scoreboard] 准备增加分数: identifier=${identifier}, objective=${config.scoreboardObjective}, amount=${amount}`);
        // 使用 mc.addPlayerScore，identifier 应为 UUID
        const success = mc.addPlayerScore(identifier, config.scoreboardObjective, amount); // 修正：使用 identifier 变量
        if (!success) {
             logWarning(`[addPlayerBalance - Scoreboard] mc.addPlayerScore 失败: identifier=${identifier}, objective=${config.scoreboardObjective}, amount=${amount}`);
        }
        return success; // mc.addPlayerScore 返回布尔值
    } else if (config.type === "czmoney") {
        // CzMoney 需要 xuid
        if (!czmoneyAddMoney) {
            logError("CzMoney 插件未加载或未导入成功！");
            return false;
        }
        // 假设 identifier 是 xuid
        return czmoneyAddMoney(identifier, amount);
    } else {
        // 默认 money 需要 xuid
        // 假设 identifier 是 xuid
        return money.add(identifier, amount);
    }
}


// 减少玩家余额
function reducePlayerBalance(player, amount, config) {
    if (config.type === "scoreboard") {
        // 使用计分板API减少玩家余额
        const objective = mc.getScoreObjective(config.scoreboardObjective);
        if (!objective) {
            logger.error(`计分板 ${config.scoreboardObjective} 不存在！`);
            return false;
        }
        const currentScore = objective.getScore(player);
        if (currentScore < amount) {
            return false; // 余额不足
        }
        return objective.reduceScore(player, amount) !== null;
    } else if (config.type === "czmoney") {
        // 使用 CzMoney API
        if (!czmoneyReduceMoney) {
            logger.error("CzMoney 插件未加载或未导入成功！");
            return false;
        }
        // 检查余额是否足够
        const balance = czmoneyGetMoney(player.xuid);
        if (balance < amount) {
            return false; // 余额不足
        }
        return czmoneyReduceMoney(player.xuid, amount);
    } else {
        // 使用默认money API
        return money.reduce(player.xuid, amount);
    }
}

// 处理区域购买
function handleAreaPurchase(player, point1, point2, callback) {
    const config = loadConfig().economy;
    if(!config.enabled) return true; // 如果经济系统未启用，直接返回成功
    
    const price = calculateAreaPrice(point1, point2);
    const playerBalance = getPlayerBalance(player, config);
    
    let currencyName = "金币";
    if (config.type === "scoreboard") {
        currencyName = "点";
    } else if (config.type === "czmoney") {
        currencyName = "金币"; // 或者根据 CzMoney 插件的实际货币名称修改
    }
    
    if(playerBalance < price) {
        player.tell(`§c你的余额不足！需要 ${price} ${currencyName}，当前余额 ${playerBalance} ${currencyName}`);
        return false;
    }
    
    // 扣除余额
    if(reducePlayerBalance(player, price, config)) {
        player.tell(`§a成功支付 ${price} ${currencyName}`);
        if(callback) callback();
        return true;
    } else {
        player.tell("§c扣款失败，请联系管理员");
        return false;
    }
}

// 处理区域退款 (修改为退款给区域主人)
function handleAreaRefund(player, area) { // Changed parameters: player for messages, area for owner info & points
    const config = loadConfig().economy;
    if(!config.enabled) return;

    // 优先使用 area.price 计算原始价格，否则重新计算
    const originalPrice = area.price !== undefined ? area.price : calculateAreaPrice(area.point1, area.point2);
    const refundAmount = Math.floor(originalPrice * config.refundRate);

    let currencyName = "金币";
    if (config.type === "scoreboard") {
        currencyName = "点";
    } else if (config.type === "czmoney") {
        currencyName = "金币"; // 或者根据 CzMoney 插件的实际货币名称修改
    }

    // 根据经济系统类型确定正确的区域主人标识符
    const ownerIdentifier = config.type === "scoreboard" ? area.uuid : area.xuid;
    const areaIdentifier = area.id || 'ID未知'; // 处理 area.id 可能为 undefined 的情况
    if (!ownerIdentifier) {
        logError(`无法确定区域 ${areaIdentifier} 的主人标识符 (uuid: ${area.uuid}, xuid: ${area.xuid}) 用于退款。`);
        player.tell("§c退款失败，无法找到区域主人信息，请联系管理员");
        return; // 如果找不到标识符则停止
    }

    logDebug(`尝试为区域 ${areaIdentifier} 退款 ${refundAmount} ${currencyName}`);

    // 根据经济类型决定退款对象
    let refundSuccess = false;
    let recipientIdentifier = '';
    let recipientName = '';

    if (config.type === "scoreboard") {
        // 计分板经济：退款给操作玩家
        recipientIdentifier = player.uuid; // 操作玩家的 UUID
        recipientName = player.name;
        logDebug(`计分板经济，尝试退款给操作玩家 ${recipientName} (UUID: ${recipientIdentifier})`);
        // refundSuccess = addPlayerBalance(recipientIdentifier, refundAmount, config); // 原代码，暂时注释
        // 使用 pl.addScore 直接退款给操作玩家
        const pl = mc.getPlayer(recipientIdentifier);
        if (pl) {
            refundSuccess = pl.addScore(config.scoreboardObjective, refundAmount);
            if (!refundSuccess) {
                logWarning(`[handleAreaRefund - Scoreboard] pl.addScore 为玩家 ${recipientName} (UUID: ${recipientIdentifier}) 增加分数失败`);
            }
        } else {
            logWarning(`[handleAreaRefund - Scoreboard] 无法获取在线玩家对象: ${recipientName} (UUID: ${recipientIdentifier})，无法使用 pl.addScore 退款`);
            // 可以在这里考虑是否回退到 addPlayerBalance 或其他逻辑
        }

    } else {
        // 其他经济系统：退款给区域主人
        recipientIdentifier = area.xuid; // CzMoney 和 默认 money 使用 XUID
        recipientName = area.playerName || `标识符 ${recipientIdentifier}`;
        logDebug(`非计分板经济，尝试退款给区域主人 ${recipientName} (XUID: ${recipientIdentifier})`);
        refundSuccess = addPlayerBalance(recipientIdentifier, refundAmount, config);
    }


    // 处理退款结果
    if(refundSuccess) {
        // 退款成功逻辑...
        // 更新获取 recipientName 的逻辑，因为可能已经是操作玩家的名字了
        if (config.type !== "scoreboard" && typeof getOfflinePlayerData === 'function') { // 仅在非计分板退款给主人时尝试获取离线数据
            try {
                const ownerData = getOfflinePlayerData(area.uuid); // 仍然用 UUID 获取离线数据以显示名字
                if (ownerData && ownerData.name) {
                    recipientName = ownerData.name; // 更新主人名字
                } else {
                    logDebug(`[handleAreaRefund] getOfflinePlayerData 未能找到区域主人 ${area.uuid} 的数据或名称。`);
                }
            } catch (e) {
                logError(`[handleAreaRefund] 调用 getOfflinePlayerData 时出错: ${e}`);
            }
        } else if (config.type !== "scoreboard") { // 如果不是计分板且 getOfflinePlayerData 不可用
             logWarning("[handleAreaRefund] ll.import('PlayerData', 'getOfflinePlayerData') 可能失败，无法获取离线区域主人名称。");
        }

        // 根据退款对象调整通知信息
        if (config.type === "scoreboard") {
            player.tell(`§a已向你退还 ${refundAmount} ${currencyName}（${config.refundRate * 100}%）`);
        } else {
            player.tell(`§a已向区域主人 ${recipientName} 退还 ${refundAmount} ${currencyName}（${config.refundRate * 100}%）`);
            // 尝试通知在线的区域主人 (仅在非计分板模式下)
            const ownerPlayer = mc.getPlayer(area.uuid); // 使用 UUID 获取在线玩家对象
            if (ownerPlayer) {
                ownerPlayer.tell(`§a你拥有的区域 "${area.name}" 被删除，已向你退还 ${refundAmount} ${currencyName}`);
            }
        }

    } else {
        // 根据退款对象调整失败信息
        if (config.type === "scoreboard") {
            player.tell("§c向你退款失败，请联系管理员");
            logError(`为区域 ${areaIdentifier} 向操作玩家 ${recipientName} (UUID: ${recipientIdentifier}) 退款 ${refundAmount} ${currencyName} 失败`);
        } else {
            player.tell("§c向区域主人退款失败，请联系管理员");
            logError(`为区域 ${areaIdentifier} 向主人 ${recipientName} (XUID: ${recipientIdentifier}) 退款 ${refundAmount} ${currencyName} 失败`);
        }
        // 如果是因为玩家离线导致的失败，addPlayerBalance 内部会记录更详细的日志
    }
}


// 获取维度名称
function getDimensionName(dimid) {
    switch(dimid) {
        case 0: return 'overworld';
        case 1: return 'nether';
        case 2: return 'end';
        default: return 'overworld';
    }
}

module.exports = {
    calculateAreaPrice,
    handleAreaPurchase,
    handleAreaRefund,
    getPlayerBalance,      // 新增导出
    addPlayerBalance,      // 新增导出
    reducePlayerBalance    // 新增导出
};
