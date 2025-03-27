// utils.js
const { logDebug, logInfo, logWarning, logError } = require('./logger');
const { querySpatialIndex } = require('./spatialIndex'); // 引入空间索引查询函数

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
 * @returns {Array<{id: string, area: object, isSubarea: boolean, parentAreaId: string|null}>}
 */
function getPriorityAreasAtPosition(pos, areaData, spatialIndex) {
    let areasAtPos = [];
    const candidateAreaIds = querySpatialIndex(pos, spatialIndex); // 使用索引获取候选区域

    logDebug(`位置 ${JSON.stringify(pos)} 的候选区域数: ${candidateAreaIds.length}`);

    // 只检查候选区域
    for (const areaId of candidateAreaIds) {
        const area = areaData[areaId];
        // 确保区域数据存在，以防索引和实际数据短暂不同步（虽然理论上应该同步）
        if (!area) {
            logWarning(`空间索引中的区域ID ${areaId} 在 areaData 中未找到，可能数据不同步`);
            continue;
        }

        if (isInArea(pos, area)) {
            areasAtPos.push({
                id: areaId,
                area: area,
                isSubarea: !!area.isSubarea,
                parentAreaId: area.parentAreaId
            });
        }
    }

    // 按优先级排序：子区域优先于父区域
    areasAtPos.sort((a, b) => {
        // 可以根据 area.priority 字段进行更精细的排序（如果需要）
        if (a.isSubarea && !b.isSubarea) return -1;
        if (!a.isSubarea && b.isSubarea) return 1;
        // 如果优先级相同（都是子区域或都不是），可以根据创建时间或其他标准排序
        // return (b.area.priority || 0) - (a.area.priority || 0); // 假设有 priority 字段
        return 0; // 保持原有简单排序
    });

    logDebug(`位置 ${JSON.stringify(pos)} 实际命中的区域数: ${areasAtPos.length}`);
    return areasAtPos;
}


// 获取位置优先级最高的区域 (需要传递 spatialIndex)
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

// 检查新区域是否与任何现有区域重叠
function checkNewAreaOverlap(newArea, existingAreas) {
    // 遍历所有现有区域
    for(let areaId in existingAreas) {
        const existingArea = existingAreas[areaId];
        // 如果发现重叠,返回重叠的区域信息
        if(checkAreasOverlap(newArea, existingArea)) {
            return {
                overlapped: true,
                overlappingArea: {
                    id: areaId,
                    name: existingArea.name
                }
            };
        }
    }
    
    // 没有重叠返回false
    return {
        overlapped: false,
        overlappingArea: null
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
    getPriorityAreasAtPosition, // 导出新函数
    getHighestPriorityArea,
    checkAreaSizeLimits,
    countPlayerAreas,
    matchesIdPattern
};
