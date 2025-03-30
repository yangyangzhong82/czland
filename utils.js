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

    logDebug(`位置 ${JSON.stringify(pos)} 的候选区域数: ${candidateAreaIds.length}`);

    // 递归函数计算区域深度
    const getAreaDepth = (areaId, currentDepth = 0, visited = new Set()) => {
        // --- Debug Log ---
        try { // Add try-catch for safety during debugging
            //logDebug(`[getAreaDepth] Checking areaId: ${areaId}, currentDepth: ${currentDepth}, visited: ${JSON.stringify(Array.from(visited))}`);
        } catch(e) { logError(`Error logging getAreaDepth start: ${e.message}`); }
        // --- End Debug Log ---

        if (!areaData[areaId]) {
             //logWarning(`[getAreaDepth] Area ${areaId} not found in areaData.`);
             return currentDepth; // Return current depth if area not found
        }
        if (visited.has(areaId)) {
            //logWarning(`[getAreaDepth] Circular reference detected for areaId: ${areaId}. Returning current depth ${currentDepth}.`);
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
            //logWarning(`空间索引中的区域ID ${areaId} 在 areaData 中未找到，可能数据不同步`);
            continue;
        }

        if (isInArea(pos, area)) {
            const depth = getAreaDepth(areaId); // 计算深度
            areasAtPos.push({
                id: areaId,
                area: area,
                isSubarea: !!area.isSubarea,
                parentAreaId: area.parentAreaId,
                depth: depth // 添加深度信息
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

    logDebug(`位置 ${JSON.stringify(pos)} 实际命中的区域数: ${areasAtPos.length}, 排序后: ${areasAtPos.map(a => `${a.id}(${a.depth})`).join(', ')}`);
    return areasAtPos;
}


// 获取位置优先级最高的区域 (需要传递 spatialIndex)
function getHighestPriorityArea(pos, areaData, spatialIndex) {
    const areas = getPriorityAreasAtPosition(pos, areaData, spatialIndex); // 传递 spatialIndex
    return areas.length > 0 ? areas[0] : null;
}


/**
 * 计算指定区域的深度（层级）
 * @param {string} areaId - 要计算深度的区域ID
 * @param {object} areaData - 所有区域的数据
 * @param {number} [currentDepth=0] - 当前递归深度（内部使用）
 * @param {Set<string>} [visited=new Set()] - 用于检测循环引用的集合（内部使用）
 * @returns {number} 区域的深度（0代表主区域，1代表一级子区域，以此类推），如果区域不存在或检测到循环则返回当前深度
 */
function getAreaDepth(areaId, areaData, currentDepth = 0, visited = new Set()) {
    // --- Debug Log ---
    // logDebug(`[getAreaDepth] Checking areaId: ${areaId}, currentDepth: ${currentDepth}, visited: ${JSON.stringify(Array.from(visited))}`);
    // --- End Debug Log ---

    if (!areaData || !areaData[areaId]) {
        // logWarning(`[getAreaDepth] Area ${areaId} not found in areaData.`);
        return currentDepth; // 区域不存在，返回当前深度
    }
    if (visited.has(areaId)) {
        logWarning(`[getAreaDepth] Circular reference detected for areaId: ${areaId}. Returning current depth ${currentDepth}.`);
        return currentDepth; // 检测到循环引用，停止递归
    }
    visited.add(areaId); // 标记为已访问

    const area = areaData[areaId];
    // --- Debug Log ---
    // logDebug(`[getAreaDepth] Area ${areaId} data: isSubarea=${area.isSubarea}, parentAreaId=${area.parentAreaId}`);
    // --- End Debug Log ---

    if (!area.isSubarea || !area.parentAreaId) {
        // logDebug(`[getAreaDepth] Area ${areaId} is top-level or missing parent. Returning depth ${currentDepth}.`);
        return currentDepth; // 到达顶层区域或数据不完整
    }

    // 递归查找父区域深度，深度加 1
    // logDebug(`[getAreaDepth] Area ${areaId} is subarea. Recursing for parent ${area.parentAreaId} with depth ${currentDepth + 1}.`);
    // 创建一个新的 visited set 传递给下一层递归，避免污染当前层的状态
    return getAreaDepth(area.parentAreaId, areaData, currentDepth + 1, new Set(visited));
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

/**
 * 检查区域大小是否符合配置限制
 * @param {object} point1 - 第一个点
 * @param {object} point2 - 第二个点
 * @param {object} config - 插件配置对象
 * @param {boolean} isSubarea - 是否是子区域
 * @param {number} depth - 区域的深度 (0=主区域, 1=一级子区域, 2=二级子区域)
 * @returns {{valid: boolean, message?: string}} 检查结果
 */
function checkAreaSizeLimits(point1, point2, config, isSubarea = false, depth = 0) {
    const limitsConfig = config.areaSizeLimits;
    if (!limitsConfig || !limitsConfig.enabled) {
        logDebug(`区域大小限制已禁用，跳过检查。`);
        return { valid: true };
    }

    // --- 确定使用的限制配置 ---
    // 定义一个辅助函数来合并限制，确保 min/max 对象存在且包含所有轴和 volume
    const mergeLimits = (specific, fallback) => {
        const merged = { ...fallback }; // Start with fallback
        if (specific) {
            for (const key in specific) {
                if (specific[key] !== null && specific[key] !== undefined) {
                    merged[key] = specific[key];
                }
            }
        }
        // Ensure all required keys exist, falling back to 0 if necessary in fallback
        const defaultStructure = { x: 0, y: 0, z: 0, volume: 0 };
        return { ...defaultStructure, ...merged };
    };

    let activeMinLimits = limitsConfig.min; // 默认主区域最小限制
    let activeMaxLimits = limitsConfig.max; // 默认主区域最大限制
    let limitSource = "主区域"; // 用于日志记录

    if (isSubarea) {
        const generalSubareaMin = limitsConfig.subarea?.enabled ? (limitsConfig.subarea.min || limitsConfig.min) : limitsConfig.min;
        const generalSubareaMax = limitsConfig.subarea?.enabled ? (limitsConfig.subarea.max || limitsConfig.max) : limitsConfig.max;

        if (depth === 2 && limitsConfig.subareaLevel3?.enabled) {
            // 使用 Level 3 (二级子区域) 配置
            activeMinLimits = mergeLimits(limitsConfig.subareaLevel3.min, generalSubareaMin);
            activeMaxLimits = mergeLimits(limitsConfig.subareaLevel3.max, generalSubareaMax);
            limitSource = "二级子区域 (Level 3)";
        } else if (depth === 1 && limitsConfig.subareaLevel2?.enabled) {
            // 使用 Level 2 (一级子区域) 配置
            activeMinLimits = mergeLimits(limitsConfig.subareaLevel2.min, generalSubareaMin);
            activeMaxLimits = mergeLimits(limitsConfig.subareaLevel2.max, generalSubareaMax);
            limitSource = "一级子区域 (Level 2)";
        } else if (limitsConfig.subarea?.enabled) {
            // 使用通用子区域配置
            activeMinLimits = mergeLimits(limitsConfig.subarea.min, limitsConfig.min);
            activeMaxLimits = mergeLimits(limitsConfig.subarea.max, limitsConfig.max);
            limitSource = "通用子区域";
        } else {
             // 如果子区域总开关或特定层级开关关闭，但 isSubarea 仍为 true，则回退到主区域限制
             limitSource = "主区域 (子区域限制未启用或不适用)";
             // activeMinLimits 和 activeMaxLimits 保持主区域默认值
        }
    }
    // 确保最终的限制对象结构完整
    activeMinLimits = mergeLimits(activeMinLimits, { x: 0, y: 0, z: 0, volume: 0 });
    activeMaxLimits = mergeLimits(activeMaxLimits, { x: 0, y: 0, z: 0, volume: 0 });


    logDebug(`检查区域大小限制，使用配置来源: ${limitSource} (深度: ${depth})`);
    logDebug(`  - Min Limits: ${JSON.stringify(activeMinLimits)}`);
    logDebug(`  - Max Limits: ${JSON.stringify(activeMaxLimits)}`);


    // --- 计算区域尺寸 ---
    const dx = Math.abs(point2.x - point1.x) + 1; // +1因为包含起点和终点
    const dy = Math.abs(point2.y - point1.y) + 1;
    const dz = Math.abs(point2.z - point1.z) + 1;
    const volume = dx * dy * dz;

    logDebug(`计算尺寸: dx=${dx}, dy=${dy}, dz=${dz}, volume=${volume}`);

    // --- 检查最小限制 ---
    // 只有当限制值大于0时才进行检查
    if (activeMinLimits.x > 0 && dx < activeMinLimits.x) {
        return { valid: false, message: `X轴长度(${dx})小于来源[${limitSource}]的最小值 ${activeMinLimits.x}` };
    }
    if (activeMinLimits.y > 0 && dy < activeMinLimits.y) {
        return { valid: false, message: `Y轴高度(${dy})小于来源[${limitSource}]的最小值 ${activeMinLimits.y}` };
    }
    if (activeMinLimits.z > 0 && dz < activeMinLimits.z) {
        return { valid: false, message: `Z轴宽度(${dz})小于来源[${limitSource}]的最小值 ${activeMinLimits.z}` };
    }
    if (activeMinLimits.volume > 0 && volume < activeMinLimits.volume) {
        return { valid: false, message: `区域体积(${volume})小于来源[${limitSource}]的最小值 ${activeMinLimits.volume}` };
    }

    // --- 检查最大限制 ---
    // 只有当限制值大于0时才进行检查
    if (activeMaxLimits.x > 0 && dx > activeMaxLimits.x) {
        return { valid: false, message: `X轴长度(${dx})超过来源[${limitSource}]的最大值 ${activeMaxLimits.x}` };
    }
    if (activeMaxLimits.y > 0 && dy > activeMaxLimits.y) {
        return { valid: false, message: `Y轴高度(${dy})超过来源[${limitSource}]的最大值 ${activeMaxLimits.y}` };
    }
    if (activeMaxLimits.z > 0 && dz > activeMaxLimits.z) {
        return { valid: false, message: `Z轴宽度(${dz})超过来源[${limitSource}]的最大值 ${activeMaxLimits.z}` };
    }
    if (activeMaxLimits.volume > 0 && volume > activeMaxLimits.volume) {
        return { valid: false, message: `区域体积(${volume})超过来源[${limitSource}]的最大值 ${activeMaxLimits.volume}` };
    }

    logDebug(`区域大小检查通过，使用来源: ${limitSource}`);
    return { valid: true };
}

/**
 * 计算并返回指定玩家拥有的各类区域的数量和总体积统计信息。
 * @param {string} playerXuid - 玩家的 XUID。
 * @param {object} areaData - 包含所有区域数据的对象。
 * @returns {object} 一个包含各层级区域统计信息的对象，格式如下：
 * {
 *   main: { count: number, totalVolume: number },          // 深度 0
 *   subarea: { count: number, totalVolume: number },       // 深度 1
 *   subareaLevel2: { count: number, totalVolume: number }, // 深度 2
 *   subareaLevel3: { count: number, totalVolume: number }  // 深度 3 及以上
 * }
 */
function calculatePlayerAreaStats(playerXuid, areaData) {
    let stats = {
        main: { count: 0, totalVolume: 0 },
        subarea: { count: 0, totalVolume: 0 },       // Depth 1
        subareaLevel2: { count: 0, totalVolume: 0 }, // Depth 2
        subareaLevel3: { count: 0, totalVolume: 0 }  // Depth 3+
    };

    if (!areaData || typeof areaData !== 'object') {
        logError("[calculatePlayerAreaStats] Invalid areaData provided.");
        return stats; // 返回空统计信息
    }

    for (const areaId in areaData) {
        // 确保 areaId 是 areaData 自身的属性
        if (!Object.prototype.hasOwnProperty.call(areaData, areaId)) {
            continue;
        }

        const area = areaData[areaId];

        // 检查区域对象和所有者 XUID 是否有效
        if (!area || typeof area !== 'object' || area.xuid !== playerXuid) {
            continue;
        }

        // 确保 point1 和 point2 存在且是对象
        if (!area.point1 || typeof area.point1 !== 'object' || !area.point2 || typeof area.point2 !== 'object') {
            logWarning(`[calculatePlayerAreaStats] Area ${areaId} for player ${playerXuid} has invalid points.`);
            continue; // 跳过无效区域
        }

        const depth = getAreaDepth(areaId, areaData); // 计算深度
        const volume = calculateAreaVolume(area.point1, area.point2); // 计算体积

        if (depth === 0) {
            stats.main.count++;
            stats.main.totalVolume += volume;
        } else if (depth === 1) {
            stats.subarea.count++;
            stats.subarea.totalVolume += volume;
        } else if (depth === 2) {
            stats.subareaLevel2.count++;
            stats.subareaLevel2.totalVolume += volume;
        } else { // Depth 3 and deeper
            stats.subareaLevel3.count++;
            stats.subareaLevel3.totalVolume += volume;
        }
    }
    logDebug(`[calculatePlayerAreaStats] Player ${playerXuid} stats: ${JSON.stringify(stats)}`);
    return stats;
}


/**
 * 计算区域的体积
 * @param {object} point1
 * @param {object} point2
 * @returns {number} 体积
 */
function calculateAreaVolume(point1, point2) {
    const dx = Math.abs(point2.x - point1.x) + 1;
    const dy = Math.abs(point2.y - point1.y) + 1;
    const dz = Math.abs(point2.z - point1.z) + 1;
    return dx * dy * dz;
}


/**
 * 检查玩家创建新区域是否会超过配置的数量或总体积限制
 * @param {string} playerXuid - 玩家XUID
 * @param {number} newAreaDepth - 新区域的深度 (0: main, 1: sub, 2: level2, 3: level3+)
 * @param {number} newAreaVolume - 新区域的体积
 * @param {object} areaData - 所有区域数据
 * @param {object} config - 插件配置
 * @returns {{valid: boolean, message?: string}} 检查结果
 */
function checkPlayerAreaLimits(playerXuid, newAreaDepth, newAreaVolume, areaData, config) {
    const limitsConfig = config.playerAreaLimits;
    if (!limitsConfig || !limitsConfig.enabled) {
        logDebug(`玩家区域限制已禁用，跳过检查。`);
        return { valid: true };
    }

    const playerStats = calculatePlayerAreaStats(playerXuid, areaData); // 获取当前统计

    let limitKey;
    let limitName;
    if (newAreaDepth === 0) {
        limitKey = 'main';
        limitName = '主区域';
    } else if (newAreaDepth === 1) {
        limitKey = 'subarea';
        limitName = '一级子区域';
    } else if (newAreaDepth === 2) {
        limitKey = 'subareaLevel2';
        limitName = '二级子区域';
    } else { // Depth 3+
        limitKey = 'subareaLevel3';
        limitName = '三级及更深子区域';
    }

    const limits = limitsConfig[limitKey];
    if (!limits) {
        logWarning(`未找到针对深度 ${newAreaDepth} (key: ${limitKey}) 的玩家区域限制配置。`);
        return { valid: true }; // 没有找到特定限制，则认为有效
    }

    const currentStats = playerStats[limitKey];

    // 检查数量限制 (-1 表示不限制)
    if (limits.maxCount !== -1 && currentStats.count >= limits.maxCount) {
        return { valid: false, message: `你拥有的${limitName}数量 (${currentStats.count}) 已达到上限 (${limits.maxCount})` };
    }

    // 检查总体积限制 (-1 表示不限制)
    if (limits.maxTotalVolume !== -1 && (currentStats.totalVolume + newAreaVolume) > limits.maxTotalVolume) {
        return { valid: false, message: `创建此区域将使你的${limitName}总体积 (${currentStats.totalVolume + newAreaVolume}) 超过上限 (${limits.maxTotalVolume})` };
    }

    logDebug(`玩家 ${playerXuid} 的 ${limitName} 限制检查通过。当前: ${currentStats.count}个, ${currentStats.totalVolume}体积。新区域体积: ${newAreaVolume}。限制: ${limits.maxCount}个, ${limits.maxTotalVolume}体积。`);
    return { valid: true };
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
    // countPlayerAreas, // 移除旧的导出
    calculatePlayerAreaStats, // 确保导出新的函数
    calculateAreaVolume,      // 新增导出
    checkPlayerAreaLimits,    // 新增导出
    matchesIdPattern,
    getAreaHierarchyPath, // 新增导出
    findNearestBoundaryPoint,
    getAreaDepth, // 导出 getAreaDepth
    calculateIntersectionVolume, // 新增导出
    calculateVolumeOutside, // 新增导出
    checkNewAreaOverlap, // 导出重叠检查
    checkAreaSizeLimits, // 导出大小限制检查
    isAreaWithinArea // 导出包含检查
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
    // 保持玩家 Y 坐标可能更安全，除非 Y 是最近的面。
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


/**
 * 获取区域的层级路径字符串 (最多显示指定层级)
 * @param {string} areaId - 当前区域ID
 * @param {object} areaData - 所有区域数据
 * @param {number} [maxLevels=3] - 最多显示的层级数 (包括当前层)
 * @returns {string} 层级路径字符串，例如 "主区域 > 子区域1 > 子区域2"
 */
function getAreaHierarchyPath(areaId, areaData, maxLevels = 3) {
    const path = [];
    let currentId = areaId;
    let level = 0;

    while (currentId && areaData[currentId] && level < maxLevels) {
        const currentArea = areaData[currentId];
        // 使用区域名称，如果名称不存在，则使用部分ID作为备用
        path.unshift(currentArea.name || `区域...${currentId.substring(currentId.length - 4)}`); // 从前面插入

        if (!currentArea.isSubarea || !currentArea.parentAreaId) {
            break; // 到达顶层或数据中断
        }
        currentId = currentArea.parentAreaId;
        level++;
    }

    // 如果因为达到 maxLevels 而停止，且还有更上层，则在前面加上 "..."
    if (level === maxLevels && currentId && areaData[currentId] && areaData[currentId].parentAreaId && areaData[areaData[currentId].parentAreaId]) {
        path.unshift("...");
    }

    return path.join(" / "); // 使用 " / " 分隔，更简洁
}


/**
 * 计算两个区域相交部分的体积
 * @param {object} areaA - 第一个区域 { point1: {x,y,z}, point2: {x,y,z}, dimid }
 * @param {object} areaB - 第二个区域 { point1: {x,y,z}, point2: {x,y,z}, dimid }
 * @returns {number} 相交部分的体积，如果不重叠或维度不同则返回 0
 */
function calculateIntersectionVolume(areaA, areaB) {
    if (!areaA || !areaB || areaA.dimid !== areaB.dimid) {
        return 0; // 维度不同或区域无效，不相交
    }

    // 获取区域A的边界
    const aMinX = Math.min(areaA.point1.x, areaA.point2.x);
    const aMaxX = Math.max(areaA.point1.x, areaA.point2.x);
    const aMinY = Math.min(areaA.point1.y, areaA.point2.y);
    const aMaxY = Math.max(areaA.point1.y, areaA.point2.y);
    const aMinZ = Math.min(areaA.point1.z, areaA.point2.z);
    const aMaxZ = Math.max(areaA.point1.z, areaA.point2.z);

    // 获取区域B的边界
    const bMinX = Math.min(areaB.point1.x, areaB.point2.x);
    const bMaxX = Math.max(areaB.point1.x, areaB.point2.x);
    const bMinY = Math.min(areaB.point1.y, areaB.point2.y);
    const bMaxY = Math.max(areaB.point1.y, areaB.point2.y);
    const bMinZ = Math.min(areaB.point1.z, areaB.point2.z);
    const bMaxZ = Math.max(areaB.point1.z, areaB.point2.z);

    // 计算相交区域的边界
    const intersectMinX = Math.max(aMinX, bMinX);
    const intersectMaxX = Math.min(aMaxX, bMaxX);
    const intersectMinY = Math.max(aMinY, bMinY);
    const intersectMaxY = Math.min(aMaxY, bMaxY);
    const intersectMinZ = Math.max(aMinZ, bMinZ);
    const intersectMaxZ = Math.min(aMaxZ, bMaxZ);

    // 检查是否存在重叠区域
    if (intersectMinX > intersectMaxX || intersectMinY > intersectMaxY || intersectMinZ > intersectMaxZ) {
        return 0; // 没有重叠
    }

    // 计算相交体积
    const intersectDx = intersectMaxX - intersectMinX + 1;
    const intersectDy = intersectMaxY - intersectMinY + 1;
    const intersectDz = intersectMaxZ - intersectMinZ + 1;

    return intersectDx * intersectDy * intersectDz;
}


/**
 * 计算区域 A 在区域 B 之外的体积
 * @param {object} areaA - 区域 A { point1: {x,y,z}, point2: {x,y,z}, dimid }
 * @param {object} areaB - 区域 B { point1: {x,y,z}, point2: {x,y,z}, dimid }
 * @returns {number} 区域 A 在区域 B 之外的体积。如果维度不同或区域 A 无效，返回区域 A 的总体积。
 */
function calculateVolumeOutside(areaA, areaB) {
    if (!areaA || !areaA.point1 || !areaA.point2) {
        logWarning("[calculateVolumeOutside] Invalid areaA provided.");
        return 0; // 无效区域 A，体积为 0
    }

    const totalVolumeA = calculateAreaVolume(areaA.point1, areaA.point2);

    if (!areaB || !areaB.point1 || !areaB.point2 || areaA.dimid !== areaB.dimid) {
        // 如果区域 B 无效或维度不同，则区域 A 完全在区域 B 之外
        return totalVolumeA;
    }

    const intersectionVolume = calculateIntersectionVolume(areaA, areaB);

    // 外部体积 = 总体积 - 相交体积
    const volumeOutside = totalVolumeA - intersectionVolume;

    // 确保体积不为负（理论上不应发生，除非浮点误差）
    return Math.max(0, volumeOutside);
}
