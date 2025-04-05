// teleport.js
const { loadConfig } = require('./configManager');
const { getAreaData, updateAreaData, getSpatialIndex } = require('./czareaprotection'); // 从 czareaprotection 引入 getAreaData, updateAreaData, getSpatialIndex
const { saveAreaData } = require('./config'); // 从 config 引入 saveAreaData
const { checkPermission } = require('./permission');
const { getPlayerBalance, reducePlayerBalance } = require('./economy'); // 引入经济函数
const { logInfo, logError, logDebug } = require('./logger');
const { getPlayerData } = require('./playerDataManager'); // 引入玩家数据管理器
const { isInArea, getHighestPriorityArea } = require('./utils'); // 引入 isInArea 和 getHighestPriorityArea 工具函数

// 用于存储玩家传送冷却时间戳
const playerTeleportCooldowns = {};

/**
 * 设置区域的传送点为玩家当前位置
 * @param {Player} player 执行操作的玩家
 * @param {string} areaId 区域ID
 * @returns {boolean} 是否成功设置
 */
function setAreaTeleportPoint(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];

    if (!area) {
        player.tell("§c错误：找不到该区域！");
        return false;
    }

    // 权限检查 (需要 MANAGE 权限)
    if (!checkPermission(player, areaData, areaId, "MANAGE")) {
        player.tell("§c你没有权限设置此区域的传送点！");
        return false;
    }

    // 获取玩家存储的数据
    const playerData = getPlayerData();
    const playerStoredData = playerData[player.uuid];

    if (!playerStoredData || !playerStoredData.pos1) {
        player.tell("§c错误：你尚未设置选择点1 (pos1)！请先使用工具选择点1。");
        return false;
    }

    const pos1 = playerStoredData.pos1;

    // 检查 pos1 是否在区域内
    if (!isInArea(pos1, area)) {
        player.tell(`§c错误：你选择的点1 (${pos1.x.toFixed(1)}, ${pos1.y.toFixed(1)}, ${pos1.z.toFixed(1)}) 不在区域 "${area.name}" 内！`);
        return false;
    }

    const rot = player.direction; // 仍然使用玩家当前的朝向

    // 存储传送点信息，使用 pos1 的坐标和玩家当前的朝向
    area.teleportPoint = {
        x: pos1.x,
        y: pos1.y,
        z: pos1.z,
        dimid: pos1.dimid, // 使用 pos1 的维度
        yaw: rot.yaw, // 存储 Yaw
        pitch: rot.pitch // 存储 Pitch
    };

    if (saveAreaData(areaData)) {
        updateAreaData(areaData); // 更新内存中的数据
        player.tell(`§a成功将区域 "${area.name}" 的传送点设置为你选择的点1 (${pos1.x.toFixed(1)}, ${pos1.y.toFixed(1)}, ${pos1.z.toFixed(1)})！`);
        logInfo(`玩家 ${player.name} 使用 pos1 设置了区域 ${areaId} 的传送点`);
        return true;
    } else {
        player.tell("§c保存传送点信息失败！");
        logError(`保存区域 ${areaId} 的传送点失败`);
        return false;
    }
}

/**
 * 获取区域的传送目标点信息 (坐标和朝向)
 * @param {string} areaId 区域ID
 * @returns {{pos: {x: number, y: number, z: number, dimid: number}, rot: {yaw: number, pitch: number}} | null} 传送目标点信息或 null
 */
function getAreaTeleportTarget(areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];

    if (!area) {
        logError(`获取传送目标失败：找不到区域 ${areaId}`);
        return null;
    }

    // 检查是否设置了传送点
    if (area.teleportPoint && typeof area.teleportPoint.x === 'number') {
        // 返回设置的传送点信息
        return {
            pos: {
                x: area.teleportPoint.x,
                y: area.teleportPoint.y,
                z: area.teleportPoint.z,
                dimid: area.teleportPoint.dimid
            },
            rot: { // 返回存储的朝向
                yaw: area.teleportPoint.yaw,
                pitch: area.teleportPoint.pitch
            }
        };
    } else {
        // 没有设置传送点，返回区域的 pos1 点，朝向使用默认值或保持不变（由 teleport 函数处理）
        if (area.point1) {
            return {
                pos: {
                    x: area.point1.x + 0.5, // 传送到方块中心
                    y: area.point1.y,       // Y 坐标通常不需要 +0.5
                    z: area.point1.z + 0.5, // 传送到方块中心
                    dimid: area.dimid
                },
                rot: null // 表示使用默认朝向或保持不变
            };
        } else {
            logError(`获取传送目标失败：区域 ${areaId} 没有传送点且缺少 point1`);
            return null;
        }
    }
}

/**
 * 将玩家传送到指定区域
 * @param {Player} player 要传送的玩家
 * @param {string} areaId 目标区域ID
 * @returns {boolean} 是否成功开始传送（经济检查通过，传送API调用）
 */
function teleportPlayerToArea(player, areaId) {
    const config = loadConfig();
    const teleportConfig = config.teleport;
    const areaData = getAreaData(); // 在开头获取一次 areaData
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    // 检查传送功能是否启用
    if (!teleportConfig.enabled) {
        player.tell("§c区域传送功能当前已禁用。");
        return false;
    }

    // --- 传送冷却检查 ---
    const cooldownSeconds = teleportConfig.teleportCooldown || 0;
    if (cooldownSeconds > 0) {
        const now = Date.now();
        const lastTeleportTime = playerTeleportCooldowns[player.uuid] || 0;
        const timeElapsed = (now - lastTeleportTime) / 1000; // 转换为秒

        if (timeElapsed < cooldownSeconds) {
            const remainingTime = Math.ceil(cooldownSeconds - timeElapsed);
            player.tell(`§c传送冷却中！请等待 ${remainingTime} 秒后再试。`);
            return false;
        }
    }

    // --- 目标区域存在性检查 ---
    const area = areaData[areaId];
    if (!area) {
        player.tell("§c错误：找不到目标区域！");
        return false;
    }

    // --- 内部传送阻止检查 ---
    if (teleportConfig.preventTeleportIfInside) {
        const currentHighestAreaInfo = getHighestPriorityArea(player.pos, areaData, spatialIndex);
        if (currentHighestAreaInfo && currentHighestAreaInfo.id === areaId) {
            player.tell(`§c你已经位于区域 "${area.name}" 内，无需传送。`);
            return false;
        }
        // 如果玩家在子区域，而目标是父区域，是否允许？目前逻辑是允许的。
    }


    // --- 权限检查 ---
    // 注意：这里我们假设有一个 "teleport" 权限
    if (!checkPermission(player, areaData, areaId, "teleport")) {
        player.tell("§c你没有权限传送到此区域！");
        return false;
    }

    // --- 获取传送目标点 ---
    const target = getAreaTeleportTarget(areaId);
    if (!target) {
        player.tell("§c无法确定传送目标点。");
        return false;
    }

    // 经济检查
    const cost = teleportConfig.costPerTeleport || 0;
    const economyConf = teleportConfig.economy;
    let currencyName = "货币"; // 默认货币名称

    if (cost > 0 && economyConf.enabled) {
        // 根据传送经济配置获取货币名称
        if (economyConf.type === "scoreboard") {
            currencyName = `点 (${economyConf.scoreboardObjective})`;
        } else if (economyConf.type === "czmoney") {
            currencyName = "金币 (CzMoney)"; // 示例
        } else {
            currencyName = "金币 (Money)"; // 示例
        }

        const playerBalance = getPlayerBalance(player, economyConf); // 使用传送经济配置

        if (playerBalance < cost) {
            player.tell(`§c传送失败！需要 ${cost} ${currencyName}，你的余额不足 (${playerBalance} ${currencyName})。`);
            return false;
        }

        // 扣除费用
        if (!reducePlayerBalance(player, cost, economyConf)) { // 使用传送经济配置
            player.tell("§c传送费用扣除失败，请联系管理员。");
            logError(`玩家 ${player.name} 传送到区域 ${areaId} 时扣费 ${cost} ${currencyName} 失败`);
            return false;
        }
        player.tell(`§a已支付传送费用 ${cost} ${currencyName}`);
    }

    // --- 执行传送 ---
    logDebug(`准备传送玩家 ${player.name} 到区域 ${areaId} 的位置: ${JSON.stringify(target.pos)}, 朝向: ${JSON.stringify(target.rot)}`);

    // 在实际传送前记录冷却时间戳
    if (cooldownSeconds > 0) {
        playerTeleportCooldowns[player.uuid] = Date.now();
    }

    let teleportSuccess = false;
    if (target.rot) {
        // 如果有指定朝向
        teleportSuccess = player.teleport(target.pos.x, target.pos.y, target.pos.z, target.pos.dimid, target.rot);
    } else {
        // 没有指定朝向，保持玩家当前朝向
        teleportSuccess = player.teleport(target.pos.x, target.pos.y, target.pos.z, target.pos.dimid);
    }


    if (teleportSuccess) {
        player.tell(`§a已将你传送到区域 "${area.name}"！`);
        logInfo(`玩家 ${player.name} 成功传送到区域 ${areaId}`);
        return true;
    } else {
        player.tell("§c传送失败！可能是目标位置无效或插件错误。");
        logError(`玩家 ${player.name} 传送到区域 ${areaId} 时 pl.teleport 调用失败`);
        // 注意：如果传送失败，费用是否应该退还？根据需求决定，目前不退还。
        return false;
    }
}

module.exports = {
    setAreaTeleportPoint,
    getAreaTeleportTarget,
    teleportPlayerToArea
};
