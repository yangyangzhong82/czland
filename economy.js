// economy.js
const { loadConfig } = require('./configManager');

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
            const formula = config.priceFormula.formula
                .replace('length', length)
                .replace('width', width) 
                .replace('height', height)
                .replace('volume', volume)
                .replace('pricePerBlock', config.pricePerBlock);
            price = eval(formula);
        } catch(e) {
            logger.error(`价格计算公式错误: ${e}`);
            price = volume * config.pricePerBlock;
        }
    } else {
        // 使用默认计算方式
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

// 处理区域购买
function handleAreaPurchase(player, point1, point2, callback) {
    const price = calculateAreaPrice(point1, point2);
    const playerMoney = money.get(player.xuid); // 获取玩家余额 
    
    if(playerMoney < price) {
        player.tell(`§c你的余额不足！需要 ${price} 金币，当前余额 ${playerMoney} 金币`);
        return false;
    }
    
    // 扣除金币
    if(money.reduce(player.xuid, price)) { // 扣除玩家金币 
        player.tell(`§a成功支付 ${price} 金币`);
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
    
    if(money.add(player.xuid, refundAmount)) { // 给玩家退款 
        player.tell(`§a已退还 ${refundAmount} 金币（${config.refundRate * 100}%)`);
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
    handleAreaRefund
};