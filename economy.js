// economy.js
// economy.js
const { loadConfig } = require('./configManager');
const { logDebug, logInfo, logWarning, logError } = require('./logger');
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");

// 导入 CzMoney API
let czmoneyAPI = {};
try {
    czmoneyAPI = {
        getPlayerBalance: ll.imports("czmoney", "getPlayerBalance"),
        // getRawPlayerBalance: ll.imports("czmoney", "getRawPlayerBalance"), // 按需导入
        getPlayerBalanceOrInit: ll.imports("czmoney", "getPlayerBalanceOrInit"),
        // getRawPlayerBalanceOrInit: ll.imports("czmoney", "getRawPlayerBalanceOrInit"), // 按需导入
        setPlayerBalance: ll.imports("czmoney", "setPlayerBalance"),
        addPlayerBalance: ll.imports("czmoney", "addPlayerBalance"),
        subtractPlayerBalance: ll.imports("czmoney", "subtractPlayerBalance"),
        hasAccount: ll.imports("czmoney", "hasAccount"),
        formatBalance: ll.imports("czmoney", "formatBalance"),
        // parseBalance: ll.imports("czmoney", "parseBalance"), // 按需导入
        // transferBalance: ll.imports("czmoney", "transferBalance") // 按需导入
    };
    logInfo("成功导入 CzMoney 经济系统 API");
} catch (e) {
    logWarning("导入 CzMoney 经济系统 API 失败，部分经济功能可能不可用: " + e);
    czmoneyAPI = {}; // 确保在失败时为空对象，避免后续调用出错
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
        // 注意：计分板 getScore 需要 Player 对象，而不是 UUID 或 XUID
        // 如果 player 参数可能不是 Player 对象，这里需要调整
        try {
            // 假设 player 是 Player 对象
            return objective.getScore(player);
        } catch(e) {
             logError(`获取玩家 ${player?.name || '未知'} 的计分板分数失败: ${e}`);
             return 0;
        }
    } else if (config.type === "czmoney") {
        // 使用 CzMoney API (新版)
        if (!czmoneyAPI.getPlayerBalance) {
            logError("CzMoney API (getPlayerBalance) 未加载或未导入成功！");
            return 0;
        }
        const currencyType = config.czmoneyCurrencyType || "money"; // 从配置读取或默认 "money"
        // CzMoney API 需要 UUID
        const uuid = player.uuid;
        if (!uuid) {
            logError(`无法获取玩家 ${player?.name || '未知'} 的 UUID！`);
            return 0;
        }
        // getPlayerBalance 返回以 "元" 为单位的浮点数
        const balance = czmoneyAPI.getPlayerBalance(uuid, currencyType);
        // 检查账户是否存在，因为 getPlayerBalance 在账户不存在时也返回 0.0
        if (balance === 0.0 && czmoneyAPI.hasAccount && !czmoneyAPI.hasAccount(uuid, currencyType)) {
             logDebug(`玩家 ${player.name} (${uuid}) 的 CzMoney 账户 (${currencyType}) 不存在。`);
             return 0; // 明确返回 0
        }
        return balance;
    } else {
        // 使用默认 money API (假设它仍然使用 xuid)
        if (!money || typeof money.get !== 'function') {
             logError("默认 money API 未加载或 get 函数不可用！");
             return 0;
        }
        return money.get(player.xuid); // 保持 xuid
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
        // CzMoney 需要 uuid (新版)
        if (!czmoneyAPI.addPlayerBalance) {
            logError("CzMoney API (addPlayerBalance) 未加载或未导入成功！");
            return false;
        }
        // 假设 identifier 是 uuid
        if (typeof identifier !== 'string' || identifier.trim() === '') {
            logError(`[addPlayerBalance - CzMoney] 提供的 identifier (应为 UUID) 无效或为空: "${identifier}"。`);
            return false;
        }
        const currencyType = config.czmoneyCurrencyType || "money";
        // addPlayerBalance 需要 "元" 为单位的 amount
        // 假设传入的 amount 已经是 "元"
        logDebug(`[addPlayerBalance - CzMoney] 准备增加余额: uuid=${identifier}, currency=${currencyType}, amount=${amount}`);
        return czmoneyAPI.addPlayerBalance(identifier, currencyType, amount, "czland","退款",""); // 添加一个默认理由
    } else {
        // 默认 money 需要 xuid
        if (!money || typeof money.add !== 'function') {
             logError("默认 money API 未加载或 add 函数不可用！");
             return false;
        }
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
        // 假设 player 是 Player 对象
        return objective.reduceScore(player, amount) !== null;
    } else if (config.type === "czmoney") {
        // 使用 CzMoney API (新版)
        if (!czmoneyAPI.subtractPlayerBalance || !czmoneyAPI.getPlayerBalance) {
            logError("CzMoney API (subtractPlayerBalance 或 getPlayerBalance) 未加载或未导入成功！");
            return false;
        }
        const currencyType = config.czmoneyCurrencyType || "money";
        // CzMoney API 需要 UUID
        const uuid = player.uuid;
        if (!uuid) {
            logError(`无法获取玩家 ${player?.name || '未知'} 的 UUID！`);
            return false;
        }

        // 检查余额是否足够 (使用 getPlayerBalance，单位是 "元")
        const balance = czmoneyAPI.getPlayerBalance(uuid, currencyType);
        if (balance < amount) {
            logDebug(`[reducePlayerBalance - CzMoney] 余额不足: uuid=${uuid}, currency=${currencyType}, balance=${balance}, required=${amount}`);
            return false; // 余额不足
        }
        // subtractPlayerBalance 需要 "元" 为单位的 amount
        logDebug(`[reducePlayerBalance - CzMoney] 准备减少余额: uuid=${uuid}, currency=${currencyType}, amount=${amount}`);
        return czmoneyAPI.subtractPlayerBalance(uuid, currencyType, amount, "czland","扣款",""); 
    } else {
         if (!money || typeof money.reduce !== 'function') {
             logError("默认 money API 未加载或 reduce 函数不可用！");
             return false;
         }
        return money.reduce(player.xuid, amount); // 保持 xuid
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
        currencyName = config.czmoneyCurrencyName || "金币"; // 从配置读取或默认
    }

    // 格式化余额显示 (如果 czmoneyAPI 可用且有 formatBalance)
    let formattedBalance = playerBalance;


    if(playerBalance < price) {
        // 恢复 .toFixed(2) 用于显示
        player.tell(`§c你的余额不足！需要 ${price.toFixed(2)} ${currencyName}，当前余额 ${formattedBalance} ${currencyName}`); // formattedBalance 已经是 .toFixed(2) 或原始值
        return false;
    }
    
    // 扣除余额 (price 是数字，无需修改)
    if(reducePlayerBalance(player, price, config)) {
        // 恢复 .toFixed(2) 用于显示
        player.tell(`§a成功支付 ${price.toFixed(2)} ${currencyName}`);
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
        currencyName = config.czmoneyCurrencyName || "金币"; // 从配置读取或默认
    }

    // 根据经济系统类型确定正确的区域主人标识符
    // Scoreboard 用 UUID, CzMoney 用 UUID (新版), 默认 money 用 XUID
    let ownerIdentifier;
    if (config.type === "scoreboard") {
        ownerIdentifier = area.uuid;
    } else if (config.type === "czmoney") {
        ownerIdentifier = area.uuid; // 新版 CzMoney 使用 UUID
    } else {
        ownerIdentifier = area.xuid; // 默认 money 假设使用 XUID
    }

    const areaIdentifier = area.id || 'ID未知'; // 处理 area.id 可能为 undefined 的情况
    if (!ownerIdentifier) {
        logError(`无法确定区域 ${areaIdentifier} 的主人标识符 (类型: ${config.type}, uuid: ${area.uuid}, xuid: ${area.xuid}) 用于退款。`);
        player.tell("§c退款失败，无法找到区域主人信息 (标识符缺失)，请联系管理员");
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
        // CzMoney 或 默认 money: 退款给区域主人
        if (config.type === "czmoney") {
            recipientIdentifier = area.uuid; // CzMoney 使用 UUID
            recipientName = area.playerName || `UUID ${recipientIdentifier}`;
            logDebug(`CzMoney 经济，尝试退款给区域主人 ${recipientName} (UUID: ${recipientIdentifier})`);
        } else {
            recipientIdentifier = area.xuid; // 默认 money 使用 XUID
            recipientName = area.playerName || `XUID ${recipientIdentifier}`;
            logDebug(`默认 money 经济，尝试退款给区域主人 ${recipientName} (XUID: ${recipientIdentifier})`);
        }
        // 调用更新后的 addPlayerBalance
        refundSuccess = addPlayerBalance(recipientIdentifier, refundAmount, config);
    }


    // 处理退款结果
    if(refundSuccess) {
        // 退款成功逻辑...
        // 获取接收者名字的逻辑: 优先用 area.playerName, 然后尝试离线数据
        // 这个逻辑只在非计分板模式下需要，因为计分板模式退给操作者 player
        if (config.type !== "scoreboard") {
             // 尝试使用 area.playerName，如果无效再尝试离线数据
             if (!recipientName || recipientName.startsWith('UUID ') || recipientName.startsWith('XUID ')) {
                 if (typeof getOfflinePlayerData === 'function') {
                    try {
                        // 始终使用 UUID 获取离线数据以获得名字
                        const ownerData = getOfflinePlayerData(area.uuid);
                        if (ownerData && ownerData.name) {
                            recipientName = ownerData.name; // 更新主人名字
                        } else {
                            logDebug(`[handleAreaRefund] getOfflinePlayerData 未能找到区域主人 ${area.uuid} 的数据或名称。`);
                        }
                    } catch (e) {
                        logError(`[handleAreaRefund] 调用 getOfflinePlayerData 时出错: ${e}`);
                        // 即使获取名字失败，也继续，使用标识符作为名字
                    }
                 } else {
                     logWarning("[handleAreaRefund] ll.import('PlayerData', 'getOfflinePlayerData') 可能失败，无法获取离线区域主人名称。");
                 }
             }
        } else {
             // 计分板模式下，recipientName 已经是操作玩家的名字 player.name
             recipientName = player.name; // Ensure recipientName is set correctly for scoreboard
        }


        // 根据退款对象调整通知信息
        if (config.type === "scoreboard") {
            // 通知操作玩家 (退款接收者) - 恢复 .toFixed(2) 用于显示identifier
            player.tell(`§a已向你退还 ${refundAmount.toFixed(2)} ${currencyName}（${(config.refundRate * 100).toFixed(0)}%）`);
        } else {
            // 通知操作玩家 - 恢复 .toFixed(2) 用于显示
            player.tell(`§a已向区域主人 ${recipientName} 退还 ${refundAmount.toFixed(2)} ${currencyName}（${(config.refundRate * 100).toFixed(0)}%）`);
            // 尝试通知在线的区域主人 (退款接收者)
            const ownerPlayer = mc.getPlayer(area.uuid); // 使用 UUID 获取在线玩家对象
            if (ownerPlayer && ownerPlayer.uuid !== player.uuid) { // 确保主人不是操作者自己
                 // 恢复 .toFixed(2) 用于显示
                ownerPlayer.tell(`§a你拥有的区域 "${area.name || areaIdentifier}" 被删除，已向你退还 ${refundAmount.toFixed(2)} ${currencyName}`);
            }
        }
        // *** Corrected structure: Removed misplaced blocks ***

    } else { // refundSuccess is false
        // 根据退款对象调整失败信息
        if (config.type === "scoreboard") {
            player.tell("§c向你退款失败，请联系管理员");
             // 恢复 .toFixed(2) 用于日志记录
            logError(`为区域 ${areaIdentifier} 向操作玩家 ${recipientName} (UUID: ${recipientIdentifier}) 退款 ${refundAmount.toFixed(2)} ${currencyName} 失败`);
        } else {
            player.tell("§c向区域主人退款失败，请联系管理员");
            const idType = config.type === "czmoney" ? "UUID" : "XUID";
             // 恢复 .toFixed(2) 用于日志记录
            logError(`为区域 ${areaIdentifier} 向主人 ${recipientName} (${idType}: ${recipientIdentifier}) 退款 ${refundAmount.toFixed(2)} ${currencyName} 失败`);
        }
        // addPlayerBalance 内部应该有更详细的日志
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
