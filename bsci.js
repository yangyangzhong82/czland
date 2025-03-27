
// LiteLoader-AIDS automatic generated
/// <reference path="d:\mc\插件/dts/HelperLib-master/src/index.d.ts"/> 


const BSCI = require('../bsci-LegacyRemoteCallApi/libn.js');
const { getPlayerData } = require('./playerDataManager');
const { loadConfig } = require('./configManager');
const { logDebug, logInfo } = require('./logger');

// 追踪每个玩家当前显示的区域轮廓ID
const playerVisualizations = {};

/**
 * 显示区域可视化
 * @param {Player} player 玩家对象
 * @param {Object} pos1 第一个点的位置
 * @param {Object} pos2 第二个点的位置
 */
function showAreaVisualization(player, pos1, pos2) {
    const config = loadConfig();
    
    // 如果可视化功能被禁用，直接返回
    if (!config.visualization || !config.visualization.enabled) {
        return;
    }
    
    // 确保点在同一维度
    if (pos1.dimid !== pos2.dimid) {
        logDebug(`无法显示区域可视化：两个点不在同一维度 (${player.name})`);
        return;
    }
    
    // 清除该玩家之前的可视化效果
    clearAreaVisualization(player);
    
    const { color, thickness, duration } = config.visualization;
    
    // 使用BSCI绘制盒子
    const visualizationId = BSCI.box(
        pos1.dimid,
        pos1.x, pos1.y, pos1.z,
        pos2.x, pos2.y, pos2.z,
        color, thickness
    );
    
    if (visualizationId) {
        player.tell(`§b区域可视化已显示，将在§e${duration}秒§b后自动消失`);
        
        // 保存可视化ID和定时器ID
        playerVisualizations[player.uuid] = {
            id: visualizationId,
            timerId: setTimeout(() => {
                clearAreaVisualization(player);
                player.tell("§7区域可视化已自动关闭");
            }, duration * 1000) // 转换为毫秒
        };
        
        logDebug(`为玩家 ${player.name} 显示区域可视化，ID: ${visualizationId}`);
    } else {
        logDebug(`无法为玩家 ${player.name} 创建区域可视化`);
    }
}

/**
 * 显示区域及其子区域的可视化
 * @param {Player} player 玩家对象
 * @param {string} areaId 区域ID
 */
function showAreaWithChildrenVisualization(player, areaId) {
    const { getAreaData } = require('./czareaprotection');
    const { loadConfig } = require('./configManager');
    const { logDebug } = require('./logger');
    
    const areaData = getAreaData();
    const area = areaData[areaId];
    const config = loadConfig();
    
    if (!area) {
        player.tell("§c无法显示区域轮廓：区域不存在！");
        return;
    }
    
    // 如果可视化功能被禁用，直接返回
    if (!config.visualization || !config.visualization.enabled) {
        player.tell("§c区域可视化功能已被禁用！");
        return;
    }
    
    // 清除该玩家之前的可视化效果
    clearAreaVisualization(player);
    
    // 为子区域定义不同的颜色
    const mainAreaColor = { ...config.visualization.color }; // 主区域使用配置中的颜色
    const subAreaColor = { r: 255, g: 165, b: 0, a: 255 }; // 子区域使用橙色
    
    // 可视化ID集合
    const visualizationIds = [];
    
    // 显示主区域轮廓
    const mainVisId = BSCI.box(
        area.dimid,
        area.point1.x, area.point1.y, area.point1.z,
        area.point2.x, area.point2.y, area.point2.z,
        mainAreaColor, config.visualization.thickness
    );
    
    if (mainVisId) {
        visualizationIds.push(mainVisId);
        logDebug(`显示主区域 ${areaId} 轮廓，ID: ${mainVisId}`);
    }
    
    // 显示子区域轮廓
    let subAreaCount = 0;
    if (area.subareas && Object.keys(area.subareas).length > 0) {
        for (const subAreaId in area.subareas) {
            const subArea = areaData[subAreaId];
            if (subArea) {
                const subVisId = BSCI.box(
                    subArea.dimid,
                    subArea.point1.x, subArea.point1.y, subArea.point1.z,
                    subArea.point2.x, subArea.point2.y, subArea.point2.z,
                    subAreaColor, config.visualization.thickness
                );
                
                if (subVisId) {
                    visualizationIds.push(subVisId);
                    subAreaCount++;
                    logDebug(`显示子区域 ${subAreaId} 轮廓，ID: ${subVisId}`);
                }
            }
        }
    }
    
    // 保存可视化ID和定时器ID
    if (visualizationIds.length > 0) {
        playerVisualizations[player.uuid] = {
            id: visualizationIds,
            timerId: setTimeout(() => {
                clearAreaVisualization(player);
                //player.tell("§7区域可视化已自动关闭");
            }, config.visualization.duration * 1000) // 转换为毫秒
        };
        
        // 提示信息
        if (subAreaCount > 0) {
            //player.tell(`§b已显示主区域(§a蓝色§b)和 §e${subAreaCount} §b个子区域(§6橙色§b)的轮廓，将在§e${config.visualization.duration}秒§b后自动消失`);
        } else {
            //player.tell(`§b区域可视化已显示，将在§e${config.visualization.duration}秒§b后自动消失`);
        }
    } else {
        player.tell("§c无法创建区域可视化");
    }
}

/**
 * 清除玩家的区域可视化
 * @param {Player} player 玩家对象
 */
function clearAreaVisualization(player) {
    const visualization = playerVisualizations[player.uuid];
    
    if (visualization) {
        // 清除定时器
        if (visualization.timerId) {
            clearTimeout(visualization.timerId);
        }
        
        // 移除BSCI图形
        if (visualization.id) {
            if (Array.isArray(visualization.id)) {
                // 如果是ID数组，逐个移除
                visualization.id.forEach(id => {
                    BSCI.remove(id);
                });
                logDebug(`已移除玩家 ${player.name} 的多个区域可视化`);
            } else {
                // 如果是单个ID
                BSCI.remove(visualization.id);
                logDebug(`已移除玩家 ${player.name} 的区域可视化，ID: ${visualization.id}`);
            }
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
    showAreaVisualization,
    clearAreaVisualization,
    showAreaWithChildrenVisualization
};