// utils.js
const { logDebug, logInfo, logWarning, logError } = require('./logger');

// 引入空间索引查询和构建函数
const { querySpatialIndex, buildSpatialIndex } = require('./spatialIndex');

// 检查玩家是否在某个区域内
function isInArea(pos, area) {
    // 维度必须相同
    if(pos.dimid !== area.dimid) return false;
    
    // 获取区域的边界坐标
    const minX = Math.min(area.point1.x, area.point2.x);
    const maxX = Math.max(area.point1.x, area.point2.x);
    const minY = Math.min(area.point1.y, area.point2.y);
    const maxY = Math.max(area.point1.y, area.point2.y);
    const minZ = Math.min(area.point1.z, area.point2.z);
    const maxZ = Math.max(area.point1.z, area.point2.z);
    
    // 检查玩家坐标是否在范围内
    return pos.x >= minX && pos.x <= maxX &&
           pos.y >= minY && pos.y <= maxY &&
            pos.z >= minZ && pos.z <= maxZ;
}

/**
 * 获取指定位置的所有区域，并按优先级排序（使用空间索引优化）
 * @param {object} pos - 玩家位置 {x, y, z, dimid}
 * @param {object} areaData - 所有区域的数据 { areaId: areaObject, ... }
 * @param {object} spatialIndex - 构建好的空间索引
 * @returns {Array<{id: string, area: object, isSubarea: boolean, parentAreaId: string|null, depth: number}>} 排序后的区域信息，包含深度
 */
function getPriorityAreasAtPosition(pos, areaData, spatialIndex) {
    let areasAtPos = [];
    const candidateAreaIds = querySpatialIndex(pos, spatialIndex); // 使用索引获取候选区域

    //logDebug(`位置 ${JSON.stringify(pos)} 的候选区域数: ${candidateAreaIds.length}`);

    // 递归函数计算区域深度
    const getAreaDepth = (areaId, currentDepth = 0, visited = new Set()) => {
        // --- Debug Log ---
        try { // Add try-catch for safety during debugging
            //logDebug(`[getAreaDepth] Checking areaId: ${areaId}, currentDepth: ${currentDepth}, visited: ${JSON.stringify(Array.from(visited))}`);
        } catch(e) { logError(`Error logging getAreaDepth start: ${e.message}`); }
        // --- End Debug Log ---

        if (!areaData[areaId]) {
             logWarning(`[getAreaDepth] Area ${areaId} not found in areaData.`);
             return currentDepth; // Return current depth if area not found
        }
        if (visited.has(areaId)) {
            logWarning(`[getAreaDepth] Circular reference detected for areaId: ${areaId}. Returning current depth ${currentDepth}.`);
            return currentDepth; // Prevent infinite loops
        }
        visited.add(areaId); // 标记为已访问

        const area = areaData[areaId];
        // --- Debug Log ---
        try { // Add try-catch for safety
            //logDebug(`[getAreaDepth] Area ${areaId} data: isSubarea=${area.isSubarea}, parentAreaId=${area.parentAreaId}`);
        } catch(e) { logError(`Error logging getAreaDepth area data: ${e.message}`); }
        // --- End Debug Log ---

        if (!area.isSubarea || !area.parentAreaId) {
            //logDebug(`[getAreaDepth] Area ${areaId} is top-level or missing parent. Returning depth ${currentDepth}.`);
            return currentDepth; // 到达顶层区域或数据不完整
        }
        // 递归查找父区域深度
        //logDebug(`[getAreaDepth] Area ${areaId} is subarea. Recursing for parent ${area.parentAreaId} with depth ${currentDepth + 1}.`);
        return getAreaDepth(area.parentAreaId, currentDepth + 1, visited);
    };

    // 只检查候选区域
    for (const areaId of candidateAreaIds) {
        const area = areaData[areaId];
        // 确保区域数据存在
        if (!area) {
            logWarning(`空间索引中的区域ID ${areaId} 在 areaData 中未找到，可能数据不同步`);
            continue;
        }

        if (isInArea(pos, area)) {
            const depth = getAreaDepth(areaId); // 计算深度
            areasAtPos.push({
                id: areaId,
                area: area,
                isSubarea: !!area.isSubarea,
                parentAreaId: area.parentAreaId,
                depth: depth 
            });
        }
    }

    // 按优先级排序：深度越大的（越内层的子区域）优先级越高
    areasAtPos.sort((a, b) => {
        // 主要按深度降序排序
        if (a.depth !== b.depth) {
            return b.depth - a.depth;
        }
        // 如果深度相同，可以添加次要排序规则，例如按名称或创建时间
        // 这里暂时不加次要排序
        return 0;
    });

    //logDebug(`位置 ${JSON.stringify(pos)} 实际命中的区域数: ${areasAtPos.length}, 排序后: ${areasAtPos.map(a => `${a.id}(${a.depth})`).join(', ')}`);
    return areasAtPos;
}


// 获取位置优先级最高的区域
function getHighestPriorityArea(pos, areaData, spatialIndex) {
    const areas = getPriorityAreasAtPosition(pos, areaData, spatialIndex); // 传递 spatialIndex
    return areas.length > 0 ? areas[0] : null;
}

// 检查两个区域是否重叠
function checkAreasOverlap(area1, area2) {
    // 如果维度不同,则不重叠
    if(area1.dimid !== area2.dimid) {
        return false;
    }
    
    // 获取第一个区域的边界
    const a1MinX = Math.min(area1.point1.x, area1.point2.x);
    const a1MaxX = Math.max(area1.point1.x, area1.point2.x);
    const a1MinY = Math.min(area1.point1.y, area1.point2.y);
    const a1MaxY = Math.max(area1.point1.y, area1.point2.y);
    const a1MinZ = Math.min(area1.point1.z, area1.point2.z);
    const a1MaxZ = Math.max(area1.point1.z, area1.point2.z);
    
    // 获取第二个区域的边界
    const a2MinX = Math.min(area2.point1.x, area2.point2.x);
    const a2MaxX = Math.max(area2.point1.x, area2.point2.x);
    const a2MinY = Math.min(area2.point1.y, area2.point2.y);
    const a2MaxY = Math.max(area2.point1.y, area2.point2.y);
    const a2MinZ = Math.min(area2.point1.z, area2.point2.z);
    const a2MaxZ = Math.max(area2.point1.z, area2.point2.z);
    
    // 检查是否有重叠
    // 如果一个区域的最小值大于另一个区域的最大值,则不重叠
    // 或者一个区域的最大值小于另一个区域的最小值,则不重叠
    return !(a1MinX > a2MaxX || a1MaxX < a2MinX ||
             a1MinY > a2MaxY || a1MaxY < a2MinY ||
             a1MinZ > a2MaxZ || a1MaxZ < a2MinZ);
}

// 检查区域A是否完全在区域B内部
function isAreaWithinArea(areaA, areaB) {
    // 确保维度相同
    if(areaA.dimid !== areaB.dimid) return false;
    
    // 获取区域A的边界
    const a1MinX = Math.min(areaA.point1.x, areaA.point2.x);
    const a1MaxX = Math.max(areaA.point1.x, areaA.point2.x);
    const a1MinY = Math.min(areaA.point1.y, areaA.point2.y);
    const a1MaxY = Math.max(areaA.point1.y, areaA.point2.y);
    const a1MinZ = Math.min(areaA.point1.z, areaA.point2.z);
    const a1MaxZ = Math.max(areaA.point1.z, areaA.point2.z);
    
    // 获取区域B的边界
    const a2MinX = Math.min(areaB.point1.x, areaB.point2.x);
    const a2MaxX = Math.max(areaB.point1.x, areaB.point2.x);
    const a2MinY = Math.min(areaB.point1.y, areaB.point2.y);
    const a2MaxY = Math.max(areaB.point1.y, areaB.point2.y);
    const a2MinZ = Math.min(areaB.point1.z, areaB.point2.z);
    const a2MaxZ = Math.max(areaB.point1.z, areaB.point2.z);
    
    // 检查区域A是否完全在区域B内
    return a1MinX >= a2MinX && a1MaxX <= a2MaxX &&
           a1MinY >= a2MinY && a1MaxY <= a2MaxY &&
           a1MinZ >= a2MinZ && a1MaxZ <= a2MaxZ;
}

// 检查新区域是否与任何现有区域重叠 (优化版)
// 需要传入 spatialIndex 和 areaData
function checkNewAreaOverlap(newArea, spatialIndex, areaData) {
    // 使用空间索引查询可能与 newArea 重叠的候选区域ID
    // *** 注意: 这里假设 querySpatialIndex 可以处理区域对象或存在 querySpatialIndexForArea ***
    // 如果 querySpatialIndex 只接受点，你可能需要修改空间索引或此处的逻辑
    // 例如，查询 newArea 的几个角点和中心点来获取候选区域
    const candidateAreaIds = querySpatialIndex(newArea, spatialIndex); // 假设 querySpatialIndex 能处理区域

    logDebug(`检查新区域 ${newArea.name || '未命名'} 重叠：候选区域数 ${candidateAreaIds.length}`);

    // 遍历候选区域
    for (const areaId of candidateAreaIds) {
        const existingArea = areaData[areaId];

        // 确保区域存在且不是新区域自身（如果新区域已临时加入 areaData）
        // 注意：调用者 (createSubArea) 应该已经排除了父区域
        if (!existingArea || areaId === newArea.id /* if newArea has a temporary ID */) {
            continue;
        }

        // 检查几何重叠
        if (checkAreasOverlap(newArea, existingArea)) {
            logDebug(`新区域与现有区域 ${areaId} (${existingArea.name}) 重叠`);
            return {
                overlapped: true,
                overlappingArea: {
                    id: areaId,
                    name: existingArea.name,
                },
            };
        }
    }

    // 没有重叠返回false
    logDebug(`新区域未发现重叠`);
    return {
        overlapped: false,
        overlappingArea: null,
    };
}


function checkAreaSizeLimits(point1, point2, config, isSubarea = false) {
    // 如果没有启用大小限制，直接返回有效
    const limits = config.areaSizeLimits;
    if (!limits || !limits.enabled) {
        return { valid: true };
    }
    
    // 确定使用哪个限制配置（主区域或子区域）
    let minLimits = limits.min;
    let maxLimits = limits.max;
    
    if (isSubarea && limits.subarea && limits.subarea.enabled) {
        minLimits = limits.subarea.min || limits.min;
        maxLimits = limits.subarea.max || limits.max;
    }
    
    // 计算区域尺寸
    const dx = Math.abs(point2.x - point1.x) + 1; // +1因为包含起点和终点
    const dy = Math.abs(point2.y - point1.y) + 1;
    const dz = Math.abs(point2.z - point1.z) + 1;
    const volume = dx * dy * dz;
    
    // 检查最小限制
    if (dx < minLimits.x) {
        return { valid: false, message: `X轴长度(${dx})小于最小值${minLimits.x}` };
    }
    if (dy < minLimits.y) {
        return { valid: false, message: `Y轴高度(${dy})小于最小值${minLimits.y}` };
    }
    if (dz < minLimits.z) {
        return { valid: false, message: `Z轴宽度(${dz})小于最小值${minLimits.z}` };
    }
    if (volume < minLimits.volume) {
        return { valid: false, message: `区域体积(${volume})小于最小值${minLimits.volume}` };
    }
    
    // 检查最大限制
    if (maxLimits.x > 0 && dx > maxLimits.x) {
        return { valid: false, message: `X轴长度(${dx})超过最大值${maxLimits.x}` };
    }
    if (maxLimits.y > 0 && dy > maxLimits.y) {
        return { valid: false, message: `Y轴高度(${dy})超过最大值${maxLimits.y}` };
    }
    if (maxLimits.z > 0 && dz > maxLimits.z) {
        return { valid: false, message: `Z轴宽度(${dz})超过最大值${maxLimits.z}` };
    }
    if (maxLimits.volume > 0 && volume > maxLimits.volume) {
        return { valid: false, message: `区域体积(${volume})超过最大值${maxLimits.volume}` };
    }
    
    return { valid: true };
}

// 计算玩家拥有的区域数量
function countPlayerAreas(playerXuid, areaData) {
    let count = 0;
    for (const areaId in areaData) {
        // 只统计主区域，不计算子区域
        if (areaData[areaId].xuid === playerXuid && !areaData[areaId].isSubarea) {
            count++;
        }
    }
    return count;
}

/**
 * 计算区域的体积
 * @param {object} area - 区域对象
 * @returns {number} 区域的体积
 */
function calculateAreaVolume(area) {
    if (!area || !area.point1 || !area.point2) {
        logWarning(`[calculateAreaVolume] Invalid area object received: ${JSON.stringify(area)}`);
        return 0;
    }
    const dx = Math.abs(area.point2.x - area.point1.x) + 1;
    const dy = Math.abs(area.point2.y - area.point1.y) + 1;
    const dz = Math.abs(area.point2.z - area.point1.z) + 1;
    return dx * dy * dz;
}


/**
 * 计算玩家拥有的所有主区域的总大小（体积）
 * @param {string} playerXuid - 玩家的 XUID
 * @param {object} areaData - 所有区域的数据
 * @returns {number} 玩家拥有的主区域总大小
 */
function calculatePlayerTotalAreaSize(playerXuid, areaData) {
    let totalSize = 0;
    for (const areaId in areaData) {
        const area = areaData[areaId];
        // 只计算属于该玩家的主区域
        if (area.xuid === playerXuid && !area.isSubarea) {
            totalSize += calculateAreaVolume(area);
        }
    }
    logDebug(`[calculatePlayerTotalAreaSize] Player ${playerXuid} total main area size: ${totalSize}`);
    return totalSize;
}


/**
 * 检查ID是否匹配配置中的某个模式
 * @param {string} id - 物品、方块或实体的ID
 * @param {Array} patterns - 要匹配的模式数组
 * @returns {boolean} 是否匹配
 */
function matchesIdPattern(id, patterns) {
    if (!patterns || !Array.isArray(patterns)) return false;
    
    for (const pattern of patterns) {
        // 检查是否是正则表达式对象(如 /pattern/)
        if (pattern instanceof RegExp) {
            if (pattern.test(id)) return true;
        }
        // 检查是否是字符串形式的正则表达式(如 "/pattern/")
        else if (typeof pattern === 'string' && pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
            const regexParts = pattern.split('/');
            if (regexParts.length >= 3) {
                try {
                    const flags = regexParts[regexParts.length - 1];
                    const patternStr = regexParts.slice(1, -1).join('/');
                    const regex = new RegExp(patternStr, flags);
                    if (regex.test(id)) return true;
                } catch (e) {
                    logWarning(`无效的正则表达式: ${pattern}, 错误: ${e.message}`);
                }
            }
        }
        // 直接字符串匹配
        else if (pattern === id) {
            return true;
        }
    }
    
    return false;
}

module.exports = {
    isInArea,
    checkAreasOverlap,
    checkNewAreaOverlap,
    isAreaWithinArea,
    getPriorityAreasAtPosition, 
    getHighestPriorityArea,
    checkAreaSizeLimits,
    countPlayerAreas,
    calculateAreaVolume,
    calculatePlayerTotalAreaSize, 
    matchesIdPattern,
    findNearestBoundaryPoint
};


/**
 * 计算点 pos 到区域 area 边界最近的点，并稍微向外偏移
 * @param {object} pos - 玩家当前位置 {x, y, z, dimid}
 * @param {object} area - 区域对象 { point1: {x,y,z}, point2: {x,y,z}, dimid }
 * @returns {object|null} 最近的边界点 {x, y, z, dimid} 或 null（如果维度不匹配）
 */
function findNearestBoundaryPoint(pos, area) {
    if (pos.dimid !== area.dimid) {
        logWarning(`findNearestBoundaryPoint: Position and area dimensions do not match (${pos.dimid} vs ${area.dimid})`);
        return null;
    }

    const minX = Math.min(area.point1.x, area.point2.x);
    const maxX = Math.max(area.point1.x, area.point2.x);
    const minY = Math.min(area.point1.y, area.point2.y);
    const maxY = Math.max(area.point1.y, area.point2.y);
    const minZ = Math.min(area.point1.z, area.point2.z);
    const maxZ = Math.max(area.point1.z, area.point2.z);

    // 1. 计算玩家到每个边界的距离 (使用原始 pos)
    // 正值表示在边界内侧多远，负值表示在外侧多远
    const distToMinX = pos.x - minX;
    const distToMaxX = maxX - pos.x;
    const distToMinY = pos.y - minY;
    const distToMaxY = maxY - pos.y;
    const distToMinZ = pos.z - minZ;
    const distToMaxZ = maxZ - pos.z;

    // 2. 找到绝对值最小的距离，确定最近的边界平面
    let minDistAbs = Infinity;
    let nearestFace = null;

    if (Math.abs(distToMinX) < minDistAbs) { minDistAbs = Math.abs(distToMinX); nearestFace = 'minX'; }
    if (Math.abs(distToMaxX) < minDistAbs) { minDistAbs = Math.abs(distToMaxX); nearestFace = 'maxX'; }
    // Y 轴通常不作为主要传送目标，除非玩家正好在顶部或底部边界外
    if (Math.abs(distToMinY) < minDistAbs) { minDistAbs = Math.abs(distToMinY); nearestFace = 'minY'; }
    if (Math.abs(distToMaxY) < minDistAbs) { minDistAbs = Math.abs(distToMaxY); nearestFace = 'maxY'; }
    if (Math.abs(distToMinZ) < minDistAbs) { minDistAbs = Math.abs(distToMinZ); nearestFace = 'minZ'; }
    if (Math.abs(distToMaxZ) < minDistAbs) { minDistAbs = Math.abs(distToMaxZ); nearestFace = 'maxZ'; }

    // 3. 计算目标传送点
    const offset = 0.5; // 传送到边界外一点点
    let targetX = pos.x;
    let targetY = pos.y;
    let targetZ = pos.z;

    // 将坐标限制在区域的 XZ 平面上，Y 坐标保持玩家当前高度（或略高于地面）
    targetX = Math.max(minX, Math.min(targetX, maxX));
    targetZ = Math.max(minZ, Math.min(targetZ, maxZ));
    // Y 坐标需要小心处理，避免卡墙或掉虚空。
    // 暂时保持玩家 Y 坐标，或者设置为 minY + 1?
    // 保持玩家 Y 坐标可能更安全？除非 Y 是最近的面。
    // targetY = Math.max(minY, Math.min(targetY, maxY)); // 限制 Y

    switch (nearestFace) {
        case 'minX': targetX = minX - offset; break;
        case 'maxX': targetX = maxX + offset; break;
        case 'minY': targetY = minY - offset; break; // 传送到下方可能不好，改为 minY?
        case 'maxY': targetY = maxY + offset; break; // 传送到上方通常安全
        case 'minZ': targetZ = minZ - offset; break;
        case 'maxZ': targetZ = maxZ + offset; break;
    }

    // 再次确保坐标在合理范围内，特别是 Y
    // 如果最近的面是 minY，传送到 minY 可能比 minY - offset 好
    if (nearestFace === 'minY') {
        targetY = minY; // 传送到地面上
    }
    // 确保 X/Z 不会因为偏移而进入另一个不该进入的区域？这比较复杂。
    // 简单起见，先这样。

    logDebug(`Nearest boundary point calculated for pos ${JSON.stringify(pos)} in area [${minX}-${maxX}, ${minY}-${maxY}, ${minZ}-${maxZ}]: face=${nearestFace}, point=(${targetX.toFixed(1)}, ${targetY.toFixed(1)}, ${targetZ.toFixed(1)})`);

    return {
        x: targetX,
        y: targetY,
        z: targetZ,
        dimid: area.dimid
    };
}
