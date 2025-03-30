// economy.js
// economy.js
const { loadConfig } = require('./configManager');
const { logDebug, logInfo, logWarning, logError } = require('./logger');
const { getAreaDepth, calculateVolumeOutside, calculateAreaVolume, isAreaWithinArea } = require('./utils'); // 导入所需函数
const { getAreaData } = require('./czareaprotection'); // 导入 getAreaData
let czmoneyAddMoney, czmoneyGetMoney, czmoneyReduceMoney, czmoneySetMoney;
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
try {
    czmoneyAddMoney = ll.imports("CzMoney", "addMoney");
    czmoneyGetMoney = ll.imports("CzMoney", "getMoney");
    czmoneyReduceMoney = ll.imports("CzMoney", "reduceMoney");
    czmoneySetMoney = ll.imports("CzMoney", "setMoney");
} catch (e) {
}

/**
 * 计算区域价格
 * @param {object} point1 - 区域点1
 * @param {object} point2 - 区域点2
 * @param {boolean} isSubarea - 是否是子区域 (用于区分调用场景)
 * @param {string|null} areaId - 区域ID (如果是已存在的子区域)
 * @param {string|null} parentAreaIdForNew - 父区域ID (如果是正在创建的新子区域)
 * @returns {number} 计算出的价格
 */
function calculateAreaPrice(point1, point2, isSubarea = false, areaId = null, parentAreaIdForNew = null) {
    const fullConfig = loadConfig(); // 加载完整配置
    const mainEconomyConfig = fullConfig.economy;
    if (!mainEconomyConfig.enabled) return 0; // 主经济开关关闭则直接返回0

    const areaData = getAreaData(); // 获取所有区域数据
    let depth = 0;
    let parentArea = null;
    let subareaCoefficient = 1.0; // 默认系数为 1
    let volumeOutsideParent = 0; // 默认在父区域外的体积为 0
    let useEffectiveConfig = mainEconomyConfig; // 默认使用主经济配置
    let configSource = "主区域"; // 用于日志

    // --- 确定区域深度和父区域 ---
    if (isSubarea) {
        if (areaId && areaData[areaId] && areaData[areaId].isSubarea && areaData[areaId].parentAreaId) {
            // 已存在的子区域
            depth = getAreaDepth(areaId, areaData);
            parentArea = areaData[areaData[areaId].parentAreaId];
        } else if (!areaId && parentAreaIdForNew && areaData[parentAreaIdForNew]) {
            // 正在创建的新子区域，使用传入的父区域ID计算深度
            depth = getAreaDepth(parentAreaIdForNew, areaData) + 1;
            parentArea = areaData[parentAreaIdForNew];
            logDebug(`计算新子区域价格，父区域 ${parentAreaIdForNew}，推断深度为 ${depth}`);
        } else {
            logWarning(`计算子区域价格时信息不足 (areaId: ${areaId}, parentAreaIdForNew: ${parentAreaIdForNew})，将按主区域逻辑计算。`);
            isSubarea = false; // 信息不足，按主区域处理
            depth = 0; // 重置深度
        }
    }

    // --- 选择使用的经济配置 ---
    if (isSubarea && mainEconomyConfig.subareaEconomy && mainEconomyConfig.subareaEconomy.enabled) {
        configSource = "子区域独立";
        // 构建有效的子区域配置，回退到主配置
        useEffectiveConfig = {
            pricePerBlock: mainEconomyConfig.subareaEconomy.pricePerBlock ?? mainEconomyConfig.pricePerBlock,
            priceByVolume: mainEconomyConfig.subareaEconomy.priceByVolume ?? mainEconomyConfig.priceByVolume,
            priceFormula: mainEconomyConfig.subareaEconomy.priceFormula ?? mainEconomyConfig.priceFormula,
            priceCoefficients: mainEconomyConfig.subareaEconomy.priceCoefficients, // 系数必须来自子区域配置
            // 沿用主配置的其他项
            priceByDimension: mainEconomyConfig.priceByDimension,
            minPrice: mainEconomyConfig.minPrice,
            maxPrice: mainEconomyConfig.maxPrice,
            refundRate: mainEconomyConfig.refundRate,
            type: mainEconomyConfig.type, // 经济类型也应一致
            scoreboardObjective: mainEconomyConfig.scoreboardObjective // 计分板名称也应一致
        };
        logDebug(`使用子区域独立经济配置。PricePerBlock: ${useEffectiveConfig.pricePerBlock}, PriceByVolume: ${useEffectiveConfig.priceByVolume}`);
    } else if (isSubarea) {
        configSource = "子区域(主区域配置)";
        // 子区域经济未启用，但仍需应用系数
        useEffectiveConfig = { ...mainEconomyConfig }; // 复制主配置
        // 确保 priceCoefficients 来自主配置下的 subareaEconomy (如果存在)
        useEffectiveConfig.priceCoefficients = mainEconomyConfig.subareaEconomy?.priceCoefficients;
        logDebug(`子区域独立经济配置未启用，使用主区域配置，但会尝试应用系数。`);
    } else {
         logDebug(`计算主区域价格，使用主区域经济配置。`);
    }


    // --- 获取子区域系数 (如果适用) ---
    if (isSubarea && useEffectiveConfig.priceCoefficients) {
        if (depth === 1 && typeof useEffectiveConfig.priceCoefficients.level1 === 'number') {
            subareaCoefficient = useEffectiveConfig.priceCoefficients.level1;
        } else if (depth === 2 && typeof useEffectiveConfig.priceCoefficients.level2 === 'number') {
            subareaCoefficient = useEffectiveConfig.priceCoefficients.level2;
        }
        // 更深层级默认使用 level2 的系数或 1.0
        else if (depth > 2 && typeof useEffectiveConfig.priceCoefficients.level2 === 'number') {
             subareaCoefficient = useEffectiveConfig.priceCoefficients.level2;
        }
        logDebug(`应用子区域深度 ${depth} 的价格系数: ${subareaCoefficient}`);
    }

    // --- 计算外部体积 (如果适用) ---
    if (isSubarea && parentArea && fullConfig.areaSizeLimits && fullConfig.areaSizeLimits.subarea && fullConfig.areaSizeLimits.subarea.allowSubareaOutsideParent) {
        const subAreaObj = { point1, point2, dimid: point1.dimid };
        const parentAreaObj = { point1: parentArea.point1, point2: parentArea.point2, dimid: parentArea.dimid };
        volumeOutsideParent = calculateVolumeOutside(subAreaObj, parentAreaObj);
        if (volumeOutsideParent > 0) {
            logDebug(`子区域在父区域之外的体积: ${volumeOutsideParent}`);
        }
    }

    // --- 计算区域尺寸和总体积 ---
    const length = Math.abs(point2.x - point1.x) + 1;
    const width = Math.abs(point2.z - point1.z) + 1;
    const height = Math.abs(point2.y - point1.y) + 1;
    const totalVolume = calculateAreaVolume(point1, point2); // 使用函数计算总体积
    const volumeInsideParent = totalVolume - volumeOutsideParent; // 父区域内的体积

    let price;
    const currentPricePerBlock = useEffectiveConfig.pricePerBlock; // 当前生效的单价

    // --- 价格计算核心逻辑 ---
    if (useEffectiveConfig.priceFormula && useEffectiveConfig.priceFormula.useCustom) {
        // 使用自定义公式
        try {
            let formula = useEffectiveConfig.priceFormula.formula;
            // 替换可用变量
            formula = formula.replace(/\blength\b/g, length);
            formula = formula.replace(/\bwidth\b/g, width);
            formula = formula.replace(/\bheight\b/g, height);
            formula = formula.replace(/\bvolume\b/g, totalVolume); // 总体积
            formula = formula.replace(/\bpricePerBlock\b/g, currentPricePerBlock);
            formula = formula.replace(/\bcoefficient\b/g, subareaCoefficient); // 子区域系数
            formula = formula.replace(/\bvolumeInsideParent\b/g, volumeInsideParent); // 父区域内体积
            formula = formula.replace(/\bvolumeOutsideParent\b/g, volumeOutsideParent); // 父区域外体积
            formula = formula.replace(/\bdepth\b/g, depth); // 区域深度

            logDebug(`计算价格使用 [${configSource}] 自定义公式: ${formula}`);
            price = eval(formula); // 注意：eval有风险，确保公式来源可信

            if (typeof price !== 'number' || isNaN(price)) {
                throw new Error('公式计算结果不是有效数字');
            }
        } catch (e) {
            logError(`[${configSource}] 价格计算公式错误: ${e}`);
            // 公式错误时回退到默认计算方式
            price = useEffectiveConfig.priceByVolume
                ? (volumeInsideParent * currentPricePerBlock) + (volumeOutsideParent * currentPricePerBlock * subareaCoefficient) // 默认按体积，考虑内外和系数
                : (length + width + height) * currentPricePerBlock * subareaCoefficient; // 备用：按边长和（系数应用可能不直观）
            logWarning(`公式错误，回退到默认计算方式，价格: ${price}`);
        }
    } else {
        // 使用默认计算方式 (优先按体积)
        if (useEffectiveConfig.priceByVolume) {
            // 按体积计算，区分内外体积并应用系数
            price = (volumeInsideParent * currentPricePerBlock) + (volumeOutsideParent * currentPricePerBlock * subareaCoefficient);
            logDebug(`计算价格使用 [${configSource}] 默认体积方式: 内体积=${volumeInsideParent}, 外体积=${volumeOutsideParent}, 单价=${currentPricePerBlock}, 系数=${subareaCoefficient}, 价格=${price}`);
        } else {
            // 按边长和计算 (系数应用可能不直观，但保持逻辑)
            price = (length + width + height) * currentPricePerBlock * subareaCoefficient;
            logDebug(`计算价格使用 [${configSource}] 默认边长和方式: LWH=${length}+${width}+${height}, 单价=${currentPricePerBlock}, 系数=${subareaCoefficient}, 价格=${price}`);
        }
    }
    // --- 价格计算核心逻辑结束 ---

    // --- 应用维度倍率 (使用主配置的维度倍率) ---
    const dimName = getDimensionName(point1.dimid);
    const dimMultiplier = (mainEconomyConfig.priceByDimension && typeof mainEconomyConfig.priceByDimension[dimName] === 'number') ? mainEconomyConfig.priceByDimension[dimName] : 1;
    if (dimMultiplier !== 1) {
        price *= dimMultiplier;
        logDebug(`应用维度 ${dimName} 倍率 ${dimMultiplier}，价格变为: ${price}`);
    }

    // --- 限制价格范围 (使用主配置的min/max) ---
    const originalPrice = price;
    price = Math.max(mainEconomyConfig.minPrice > 0 ? mainEconomyConfig.minPrice : 0, price); // 最低价不能低于0
    if (mainEconomyConfig.maxPrice > 0) { // 只有当最大价格大于0时才限制
        price = Math.min(price, mainEconomyConfig.maxPrice);
    }
    if (price !== originalPrice) {
         logDebug(`应用价格范围限制 (Min: ${mainEconomyConfig.minPrice}, Max: ${mainEconomyConfig.maxPrice})，价格从 ${originalPrice} 调整为: ${price}`);
    }

    return Math.floor(price); // 返回整数价格
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
function handleAreaPurchase(player, point1, point2, isSubarea = false, parentAreaId = null, callback) {
    const fullConfig = loadConfig(); // 加载完整配置
    const mainEconomyConfig = fullConfig.economy; // 获取主经济配置，价格计算函数内部会处理子区域配置
    if (!mainEconomyConfig.enabled) {
        if (callback) callback(); // 即使经济禁用，也要执行回调
        return true; // 如果经济系统未启用，直接返回成功
    }

    // 调用 calculateAreaPrice，为新子区域传递 parentAreaId
    const price = calculateAreaPrice(point1, point2, isSubarea, null, isSubarea ? parentAreaId : null);
    const playerBalance = getPlayerBalance(player, mainEconomyConfig); // 使用主配置获取余额

    let currencyName = "金币";
    if (mainEconomyConfig.type === "scoreboard") {
        currencyName = "点";
    } else if (mainEconomyConfig.type === "czmoney") {
        currencyName = "金币"; // 或者根据 CzMoney 插件的实际货币名称修改
    }
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
function handleAreaRefund(player, area) { // player 用于发消息, area 包含区域信息
    const fullConfig = loadConfig(); // 加载完整配置
    const mainEconomyConfig = fullConfig.economy; // 获取主经济配置
    if (!mainEconomyConfig.enabled || !area) return; // 经济禁用或区域无效则退出

    // 优先使用 area.price 计算原始价格，否则重新计算
    let originalPrice;
    if (area.price !== undefined && typeof area.price === 'number') {
        originalPrice = area.price;
        logDebug(`使用区域 ${area.id} 存储的价格进行退款: ${originalPrice}`);
    } else {
        logDebug(`区域 ${area.id} 未存储价格，重新计算...`);
        // 重新计算价格，需要传入 isSubarea 和 area.id
        // parentAreaIdForNew 在这里不需要，传 null
        originalPrice = calculateAreaPrice(area.point1, area.point2, !!area.isSubarea, area.id, null);
        logDebug(`重新计算区域 ${area.id} 的价格为: ${originalPrice}`);
    }

    // 使用主配置的退款率
    const refundRate = mainEconomyConfig.refundRate;
    const refundAmount = Math.floor(originalPrice * refundRate);

    if (refundAmount <= 0) {
        logInfo(`区域 ${area.id} 退款金额为 0 或负数 (${refundAmount})，不执行退款。`);
        player.tell(`§e该区域 (${area.name}) 无需退款或退款金额为0。`);
        return; // 退款金额小于等于0，无需操作
    }

    let currencyName = "金币";
    // 使用主配置判断货币类型
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

    logInfo(`尝试为区域 ${areaIdentifier} 退款 ${refundAmount} ${currencyName}`);

    // 根据经济类型决定退款对象
    let refundSuccess = false;
    let recipientIdentifier = '';
    let recipientName = '';

    if (config.type === "scoreboard") {
        // 计分板经济：退款给操作玩家
        recipientIdentifier = player.uuid; // 操作玩家的 UUID
        recipientName = player.name;
        logInfo(`计分板经济，尝试退款给操作玩家 ${recipientName} (UUID: ${recipientIdentifier})`);
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
        logInfo(`非计分板经济，尝试退款给区域主人 ${recipientName} (XUID: ${recipientIdentifier})`);
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
