// utils.js
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

function getPriorityAreasAtPosition(pos, areaData) {
    let areasAtPos = [];
    
    // 收集所有包含该位置的区域
    for(let areaId in areaData) {
        const area = areaData[areaId];
        if(isInArea(pos, area)) {
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
        if(a.isSubarea && !b.isSubarea) return -1;
        if(!a.isSubarea && b.isSubarea) return 1;
        return 0;
    });
    
    return areasAtPos;
}

// 获取位置优先级最高的区域
function getHighestPriorityArea(pos, areaData) {
    const areas = getPriorityAreasAtPosition(pos, areaData);
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

module.exports = {
    isInArea,
    checkAreasOverlap,
    checkNewAreaOverlap,
    isAreaWithinArea,
    getPriorityAreasAtPosition, // 导出新函数
    getHighestPriorityArea,
    checkAreaSizeLimits
};