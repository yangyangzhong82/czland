// economy.js
const { loadConfig } = require('./configManager');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
let czmoneyAddMoney, czmoneyGetMoney, czmoneyReduceMoney, czmoneySetMoney;

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

// 增加玩家余额
function addPlayerBalance(player, amount, config) {
    if (config.type === "scoreboard") {
        // 使用计分板API增加玩家余额
        const objective = mc.getScoreObjective(config.scoreboardObjective);
        if (!objective) {
            logger.error(`计分板 ${config.scoreboardObjective} 不存在！`);
            return false;
        }
        const currentScore = objective.getScore(player);
        return objective.addScore(player, amount) !== null;
    } else if (config.type === "czmoney") {
        // 使用 CzMoney API
        if (!czmoneyAddMoney) {
            logger.error("CzMoney 插件未加载或未导入成功！");
            return false;
        }
        return czmoneyAddMoney(player.xuid, amount);
    } else {
        // 使用默认money API
        return money.add(player.xuid, amount);
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

// 处理区域退款
function handleAreaRefund(player, point1, point2) {
    const config = loadConfig().economy;
    if(!config.enabled) return;
    
    const originalPrice = calculateAreaPrice(point1, point2);
    const refundAmount = Math.floor(originalPrice * config.refundRate);
    
    let currencyName = "金币";
    if (config.type === "scoreboard") {
        currencyName = "点";
    } else if (config.type === "czmoney") {
        currencyName = "金币"; // 或者根据 CzMoney 插件的实际货币名称修改
    }
    
    if(addPlayerBalance(player, refundAmount, config)) {
        player.tell(`§a已退还 ${refundAmount} ${currencyName}（${config.refundRate * 100}%)`);
    } else {
        player.tell("§c退款失败，请联系管理员");
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