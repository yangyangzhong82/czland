// LiteLoader-AIDS automatic generated
/// <reference path="d:\mc\插件/dts/HelperLib-master/src/index.d.ts"/>

const { loadConfig } = require('./configManager');
const { logDebug, logInfo, logError } = require('./logger');

// 尝试加载 BSCI 库
let BSCI = null;
let bsciAvailable = false;
let isBsciEnabledInConfig = false; // 跟踪配置中的启用状态

try {
    // 首次加载配置以检查启用状态
    const initialConfig = loadConfig();
    isBsciEnabledInConfig = initialConfig.bsci && initialConfig.bsci.enabled;

    if (isBsciEnabledInConfig) {
        BSCI = require('../bsci-LegacyRemoteCallApi/libn.js');
        if (BSCI && typeof BSCI.box === 'function' && typeof BSCI.remove === 'function') {
            bsciAvailable = true;
            logInfo("BSCI 库加载成功。");
        } else {
            logError("BSCI 库加载失败或接口不完整。可视化功能将不可用。");
            BSCI = null; // 确保 BSCI 无效
        }
    } else {
        logInfo("配置中 BSCI 功能已禁用，跳过加载 BSCI 库。");
    }
} catch (e) {
    logError(`加载 BSCI 库时出错: ${e.message}. 可视化功能将不可用。`, e.stack);
    BSCI = null; // 确保 BSCI 无效
    bsciAvailable = false; // 确保状态正确
}


// 追踪每个玩家当前显示的区域轮廓ID
const playerVisualizations = {};

/**
 * 检查 BSCI 是否可用（包括配置和库加载状态）
 * @returns {boolean}
 */
function isBsciReady() {
    // 重新加载配置以获取最新状态，以防中途被修改
    const currentConfig = loadConfig();
    isBsciEnabledInConfig = currentConfig.bsci && currentConfig.bsci.enabled;
    return isBsciEnabledInConfig && bsciAvailable;
}


/**
 * 显示选点时的区域可视化
 * @param {Player} player 玩家对象
 * @param {Object} pos1 第一个点的位置
 * @param {Object} pos2 第二个点的位置
 */
function showSelectionVisualization(player, pos1, pos2) {
    if (!isBsciReady()) {
        logDebug("BSCI 未启用或不可用，跳过显示选点可视化。");
        // 可以选择是否提示玩家
        // player.tell("§c可视化功能当前不可用。");
        return;
    }

    const config = loadConfig(); // 获取最新配置

    // 确保点存在且在同一维度
    if (!pos1 || !pos2 || pos1.dimid !== pos2.dimid) {
        logDebug(`无法显示选点可视化：点无效或不在同一维度 (${player.name})`);
        player.tell("§c选点无效或不在同一维度，无法显示可视化。");
        return;
    }

    // 清除该玩家之前的可视化效果
    clearAreaVisualization(player);

    const { selectionPointColor, thickness, duration } = config.bsci;

    // 使用BSCI绘制盒子
    const visualizationId = BSCI.box(
        pos1.dimid,
        pos1.x, pos1.y, pos1.z,
        pos2.x, pos2.y, pos2.z,
        selectionPointColor, // 使用选点颜色
        thickness
    );

    if (visualizationId) {
        player.tell(`§a选区可视化已显示 (绿色)，将在§e${duration}秒§a后自动消失`);

        // 保存可视化ID和定时器ID
        playerVisualizations[player.uuid] = {
            id: visualizationId,
            timerId: setTimeout(() => {
                clearAreaVisualization(player);
                // player.tell("§7选区可视化已自动关闭"); // 按键后通常不需要提示关闭
            }, duration * 1000) // 转换为毫秒
        };

        logDebug(`为玩家 ${player.name} 显示选点可视化，ID: ${visualizationId}`);
    } else {
        logDebug(`无法为玩家 ${player.name} 创建选点可视化`);
        player.tell("§c无法创建选点可视化。");
    }
}


/**
 * 显示区域及其子区域的可视化
 * @param {Player} player 玩家对象
 * @param {string} areaId 区域ID
 */
function showAreaWithChildrenVisualization(player, areaId) {
    if (!isBsciReady()) {
        player.tell("§c区域可视化功能未启用或不可用。");
        logDebug("BSCI 未启用或不可用，跳过显示区域轮廓。");
        return;
    }

    const { getAreaData } = require('./czareaprotection'); // 延迟加载，避免循环依赖
    const config = loadConfig(); // 获取最新配置
    const areaData = getAreaData();
    const area = areaData[areaId];

    if (!area) {
        player.tell("§c无法显示区域轮廓：区域不存在！");
        return;
    }

    // 清除该玩家之前的可视化效果
    clearAreaVisualization(player);

    // 从配置读取颜色和参数
    const { mainAreaColor, subAreaColor, thickness, duration } = config.bsci;

    // 可视化ID集合
    const visualizationIds = [];

    // 显示主区域轮廓
    const mainVisId = BSCI.box(
        area.dimid,
        area.point1.x, area.point1.y, area.point1.z,
        area.point2.x, area.point2.y, area.point2.z,
        mainAreaColor, // 使用配置的主区域颜色
        thickness
    );

    if (mainVisId) {
        visualizationIds.push(mainVisId);
        logDebug(`显示主区域 ${areaId} 轮廓，ID: ${mainVisId}`);
    } else {
        logError(`无法创建主区域 ${areaId} 的轮廓可视化`);
    }

    // 显示子区域轮廓
    let subAreaCount = 0;
    // 确保 areaData 包含子区域信息，或者通过父子关系查找
    for (const subId in areaData) {
        const subArea = areaData[subId];
        if (subArea.isSubarea && subArea.parentAreaId === areaId) {
             if (subArea.dimid !== area.dimid) {
                 logWarning(`子区域 ${subId} 与父区域 ${areaId} 不在同一维度，跳过可视化。`);
                 continue;
             }
             const subVisId = BSCI.box(
                 subArea.dimid,
                 subArea.point1.x, subArea.point1.y, subArea.point1.z,
                 subArea.point2.x, subArea.point2.y, subArea.point2.z,
                 subAreaColor, // 使用配置的子区域颜色
                 thickness
             );

             if (subVisId) {
                 visualizationIds.push(subVisId);
                 subAreaCount++;
                 logDebug(`显示子区域 ${subId} 轮廓，ID: ${subVisId}`);
             } else {
                 logError(`无法创建子区域 ${subId} 的轮廓可视化`);
             }
        }
    }


    // 保存可视化ID和定时器ID
    if (visualizationIds.length > 0) {
        playerVisualizations[player.uuid] = {
            id: visualizationIds,
            timerId: setTimeout(() => {
                clearAreaVisualization(player);
                // player.tell("§7区域可视化已自动关闭"); // 自动关闭时通常不提示
            }, duration * 1000) // 转换为毫秒
        };

        // 提示信息
        let message = `§b已显示主区域轮廓`;
        if (subAreaCount > 0) {
            message += ` 和 §e${subAreaCount} §b个子区域轮廓`;
        }
        message += `，将在§e${duration}秒§b后自动消失`;
        player.tell(message);

    } else {
        player.tell("§c无法创建任何区域可视化");
        logError(`未能为区域 ${areaId} 及其子区域创建任何可视化效果`);
    }
}

/**
 * 清除玩家的区域可视化
 * @param {Player} player 玩家对象
 */
function clearAreaVisualization(player) {
    // 只有 BSCI 可用时才尝试移除
    if (!bsciAvailable || !BSCI) {
        // 如果之前有记录但BSCI失效了，也清除记录
        if (playerVisualizations[player.uuid]) {
            if (playerVisualizations[player.uuid].timerId) {
                clearTimeout(playerVisualizations[player.uuid].timerId);
            }
            delete playerVisualizations[player.uuid];
            logDebug(`BSCI 不可用，已清除玩家 ${player.name} 的可视化记录。`);
        }
        return;
    }

    const visualization = playerVisualizations[player.uuid];

    if (visualization) {
        // 清除定时器
        if (visualization.timerId) {
            clearTimeout(visualization.timerId);
        }

        // 移除BSCI图形
        try {
            if (visualization.id) {
                if (Array.isArray(visualization.id)) {
                    // 如果是ID数组，逐个移除
                    visualization.id.forEach(id => {
                        BSCI.remove(id);
                    });
                    logDebug(`已移除玩家 ${player.name} 的 ${visualization.id.length} 个区域可视化`);
                } else {
                    // 如果是单个ID
                    BSCI.remove(visualization.id);
                    logDebug(`已移除玩家 ${player.name} 的区域可视化，ID: ${visualization.id}`);
                }
            }
        } catch (removeError) {
            logError(`移除 BSCI 可视化时出错 (玩家: ${player.name}, ID: ${JSON.stringify(visualization.id)}): ${removeError.message}`, removeError.stack);
        }

        // 删除记录
        delete playerVisualizations[player.uuid];
    }
}

// 监听玩家离开事件，清理资源
mc.listen("onLeft", (player) => {
    clearAreaVisualization(player);
});

module.exports = {
    isBsciReady, // 导出检查函数
    showSelectionVisualization, // 导出选点可视化函数
    clearAreaVisualization,
    showAreaWithChildrenVisualization
};
