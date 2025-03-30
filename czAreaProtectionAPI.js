// czAreaProtectionAPI.js
const { loadAreaData, saveAreaData } = require('./config');
const { getAreaData, updateAreaData, getSpatialIndex } = require('./czareaprotection'); // 引入核心数据和更新函数
const { loadConfig } = require('./configManager');
const {
    isInArea,
    getPriorityAreasAtPosition,
    checkNewAreaOverlap,
    checkAreaSizeLimits,
    isAreaWithinArea,
    getAreaDepth,
    calculateAreaVolume
} = require('./utils');
const { buildSpatialIndex } = require('./spatialIndex'); // 引入空间索引构建函数
const { initLogger, logDebug, logInfo, logWarning, logError } = require('./logger'); // 引入日志

// 确保 Logger 已初始化 (如果 API 文件在主文件后加载，这可能不是必需的，但为了安全)
// 注意：如果此文件先于 czareaprotection.js 加载，日志可能尚未配置
// 更好的做法是确保 czareaprotection.js 先运行并初始化日志
// 这里假设日志已由主插件文件初始化

/**
 * 生成唯一的区域 ID
 * @returns {string} 新的区域 ID
 */
function generateAreaId() {
    return 'area_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * API 函数：直接创建区域
 * @param {object} areaDetails - 包含区域详细信息的对象
 * @param {string} areaDetails.name - 区域名称
 * @param {object} areaDetails.point1 - 第一个点 {x, y, z}
 * @param {object} areaDetails.point2 - 第二个点 {x, y, z}
 * @param {number} areaDetails.dimid - 维度 ID
 * @param {string} areaDetails.ownerXuid - 所有者 XUID
 * @param {string} [areaDetails.ownerUuid] - 所有者 UUID (可选)
 * @param {boolean} [areaDetails.isSubarea=false] - 是否为子区域 (可选)
 * @param {string} [areaDetails.parentAreaId=null] - 父区域 ID (如果是子区域) (可选)
 * @param {number} [areaDetails.priority=0] - 优先级 (可选)
 * @param {object} [areaDetails.additionalData={}] - 其他自定义属性 (可选)
 * @returns {{success: boolean, areaId?: string, message?: string, area?: object}} 操作结果
 */
function createArea(areaDetails) {
    logDebug(`[API.createArea] Received request: ${JSON.stringify(areaDetails)}`);
    const areaData = getAreaData(); // 获取当前所有区域数据
    const config = loadConfig(); // 加载配置以进行检查

    // --- 基本验证 ---
    if (!areaDetails || typeof areaDetails !== 'object') {
        return { success: false, message: "无效的区域详情对象" };
    }
    const {
        name, point1, point2, dimid, ownerXuid, ownerUuid,
        isSubarea = false, parentAreaId = null, priority = 0,
        additionalData = {}
    } = areaDetails;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return { success: false, message: "区域名称不能为空" };
    }
    if (!point1 || !point2 || typeof point1 !== 'object' || typeof point2 !== 'object' ||
        point1.x === undefined || point1.y === undefined || point1.z === undefined ||
        point2.x === undefined || point2.y === undefined || point2.z === undefined) {
        return { success: false, message: "区域坐标点无效" };
    }
    if (dimid === undefined || typeof dimid !== 'number') {
        return { success: false, message: "维度 ID 无效" };
    }
    if (!ownerXuid || typeof ownerXuid !== 'string') {
        return { success: false, message: "所有者 XUID 无效" };
    }

    // 确保点1是最小值，点2是最大值
    const minX = Math.min(point1.x, point2.x);
    const minY = Math.min(point1.y, point2.y);
    const minZ = Math.min(point1.z, point2.z);
    const maxX = Math.max(point1.x, point2.x);
    const maxY = Math.max(point1.y, point2.y);
    const maxZ = Math.max(point1.z, point2.z);
    const finalPoint1 = { x: minX, y: minY, z: minZ };
    const finalPoint2 = { x: maxX, y: maxY, z: maxZ };

    const newAreaId = generateAreaId();
    const newArea = {
        id: newAreaId, // 临时添加 ID 用于检查
        name: name.trim(),
        point1: finalPoint1,
        point2: finalPoint2,
        dimid: dimid,
        xuid: ownerXuid,
        uuid: ownerUuid || null, // 如果没提供 UUID 则为 null
        createTime: Date.now(),
        isSubarea: isSubarea,
        parentAreaId: isSubarea ? parentAreaId : null,
        priority: priority,
        ...additionalData // 合并其他自定义属性
    };

    // --- 子区域特定验证 ---
    let parentArea = null;
    if (isSubarea) {
        if (!parentAreaId || !areaData[parentAreaId]) {
            return { success: false, message: `子区域指定的父区域 ID "${parentAreaId}" 不存在` };
        }
        parentArea = areaData[parentAreaId];
        // 1. 检查是否允许创建该层级的子区域
        const depth = getAreaDepth(parentAreaId, areaData) + 1; // 新子区域的深度
        const creationLimits = config.subAreaCreationLimits;
        if (depth === 1 && !creationLimits.allowLevel2) {
            return { success: false, message: "配置不允许创建一级子区域 (深度 1)" };
        }
        if (depth >= 2 && !creationLimits.allowLevel3) { // 深度 2 及以上
            return { success: false, message: `配置不允许创建二级或更深子区域 (深度 ${depth})` };
        }
        // 2. 检查子区域是否在父区域内 (除非配置允许)
        if (!config.areaSizeLimits?.subarea?.allowSubareaOutsideParent && !isAreaWithinArea(newArea, parentArea)) {
            return { success: false, message: "子区域必须完全位于父区域内部" };
        }
    }

    // --- 通用检查 ---
    // 1. 检查区域大小限制 (根据是否子区域和深度)
    const depth = isSubarea ? getAreaDepth(parentAreaId, areaData) + 1 : 0;
    const sizeCheck = checkAreaSizeLimits(finalPoint1, finalPoint2, config, isSubarea, depth);
    if (!sizeCheck.valid) {
        return { success: false, message: `区域大小不符合限制: ${sizeCheck.message}` };
    }

    // 2. 检查重叠 (需要传递空间索引)
    const spatialIndex = getSpatialIndex();
    // 传递 areaId 以在检查函数内部排除自身（如果需要）
    const overlapCheck = checkNewAreaOverlap(newArea, spatialIndex, areaData, newAreaId);
    if (overlapCheck.overlapped) {
        // 如果是子区域，允许与父区域重叠，但不允许与其他区域重叠
        if (!isSubarea || overlapCheck.overlappingArea.id !== parentAreaId) {
            return { success: false, message: `新区域与现有区域 "${overlapCheck.overlappingArea.name}" (ID: ${overlapCheck.overlappingArea.id}) 重叠` };
        }
    }


    // --- 执行创建 ---
    delete newArea.id; // 从对象中移除临时 ID，因为 ID 是 areaData 的键
    areaData[newAreaId] = newArea;

    // 如果是子区域，更新父区域的 subareas 列表 (如果父区域存在)
    if (isSubarea && parentArea) {
        if (!parentArea.subareas) {
            parentArea.subareas = {};
        }
        parentArea.subareas[newAreaId] = true; // 存储引用
    }

    // 保存数据
    if (saveAreaData(areaData)) {
        logInfo(`[API.createArea] 成功创建区域: ${name} (ID: ${newAreaId})`);
        updateAreaData(areaData); // 更新内存中的数据和空间索引
        return { success: true, areaId: newAreaId, area: newArea };
    } else {
        logError(`[API.createArea] 保存区域数据失败: ${name} (ID: ${newAreaId})`);
        // 回滚添加操作 (从内存中移除)
        delete areaData[newAreaId];
        if (isSubarea && parentArea && parentArea.subareas) {
            delete parentArea.subareas[newAreaId];
        }
        // 注意：这里没有回滚 saveAreaData 内部可能的部分更改，理想情况下需要事务
        return { success: false, message: "保存区域数据失败" };
    }
}

/**
 * API 函数：修改区域属性
 * @param {string} areaId - 要修改的区域 ID
 * @param {object} propertiesToUpdate - 包含要更新的属性的对象，例如：
 *   { name: "新名称", ownerXuid: "...", point1: {x,y,z}, point2: {x,y,z}, priority: 1, additionalData: { key: value } }
 *   注意：修改 point1/point2 会重新计算边界并进行重叠/大小检查。
 *   注意：修改 isSubarea 或 parentAreaId 是复杂操作，暂不支持通过此 API 直接修改。
 * @returns {{success: boolean, message?: string, updatedArea?: object}} 操作结果
 */
function modifyAreaProperties(areaId, propertiesToUpdate) {
    logDebug(`[API.modifyAreaProperties] Received request for Area ID ${areaId}: ${JSON.stringify(propertiesToUpdate)}`);
    const areaData = getAreaData();
    const config = loadConfig();
    const area = areaData[areaId];

    if (!area) {
        return { success: false, message: `区域 ID "${areaId}" 不存在` };
    }
    if (!propertiesToUpdate || typeof propertiesToUpdate !== 'object' || Object.keys(propertiesToUpdate).length === 0) {
        return { success: false, message: "未提供要更新的属性" };
    }

    // --- 备份原始区域数据以便回滚 ---
    let originalAreaBackup;
    try {
        originalAreaBackup = JSON.parse(JSON.stringify(area));
    } catch (e) {
        logError(`[API.modifyAreaProperties] 备份原始区域数据失败: ${e.message}`);
        return { success: false, message: "备份原始区域数据失败" };
    }

    // --- 处理坐标变更 ---
    let coordinatesChanged = false;
    let newPoint1 = area.point1;
    let newPoint2 = area.point2;
    let newDimid = area.dimid;

    if (propertiesToUpdate.point1 || propertiesToUpdate.point2 || propertiesToUpdate.dimid !== undefined) {
        coordinatesChanged = true;
        newPoint1 = propertiesToUpdate.point1 || area.point1;
        newPoint2 = propertiesToUpdate.point2 || area.point2;
        newDimid = propertiesToUpdate.dimid !== undefined ? propertiesToUpdate.dimid : area.dimid;

        if (!newPoint1 || !newPoint2 || typeof newPoint1 !== 'object' || typeof newPoint2 !== 'object' ||
            newPoint1.x === undefined || newPoint1.y === undefined || newPoint1.z === undefined ||
            newPoint2.x === undefined || newPoint2.y === undefined || newPoint2.z === undefined) {
            return { success: false, message: "提供的坐标点无效" };
        }
        if (typeof newDimid !== 'number') {
            return { success: false, message: "提供的维度 ID 无效" };
        }

        // 确保点1是最小值，点2是最大值
        const minX = Math.min(newPoint1.x, newPoint2.x);
        const minY = Math.min(newPoint1.y, newPoint2.y);
        const minZ = Math.min(newPoint1.z, newPoint2.z);
        const maxX = Math.max(newPoint1.x, newPoint2.x);
        const maxY = Math.max(newPoint1.y, newPoint2.y);
        const maxZ = Math.max(newPoint1.z, newPoint2.z);
        newPoint1 = { x: minX, y: minY, z: minZ };
        newPoint2 = { x: maxX, y: maxY, z: maxZ };

        // --- 移除坐标变更相关的检查 ---
        // 开发者需要自行调用 utils.js 中的 checkAreaSizeLimits, checkNewAreaOverlap, isAreaWithinArea 进行检查

        // --- 更新坐标到 area 对象 ---
        area.point1 = newPoint1;
        area.point2 = newPoint2;
        area.dimid = newDimid;
    }

    // --- 更新其他允许修改的属性 ---
    const forbiddenKeys = ['id', 'isSubarea', 'parentAreaId', 'createTime', 'subareas', 'point1', 'point2', 'dimid']; // 禁止直接修改的或已处理的
    for (const key in propertiesToUpdate) {
        if (Object.prototype.hasOwnProperty.call(propertiesToUpdate, key) && !forbiddenKeys.includes(key)) {
            if (key === 'additionalData' && typeof propertiesToUpdate.additionalData === 'object') {
                // 合并 additionalData
                area.additionalData = { ...(area.additionalData || {}), ...propertiesToUpdate.additionalData };
            } else if (key !== 'additionalData') {
                // 直接更新其他属性 (需要更细致的类型检查和验证)
                // 例如，只允许更新已知且类型正确的字段
                const allowedKeys = ['name', 'xuid', 'uuid', 'priority']; // 示例：允许更新的字段
                if (allowedKeys.includes(key)) {
                     // 可以添加类型检查
                     if (key === 'name' && typeof propertiesToUpdate.name === 'string' && propertiesToUpdate.name.trim() !== '') {
                         area.name = propertiesToUpdate.name.trim();
                     } else if (key === 'xuid' && typeof propertiesToUpdate.xuid === 'string') {
                         area.xuid = propertiesToUpdate.xuid;
                     } else if (key === 'uuid' && typeof propertiesToUpdate.uuid === 'string') {
                         area.uuid = propertiesToUpdate.uuid;
                     } else if (key === 'priority' && typeof propertiesToUpdate.priority === 'number') {
                         area.priority = propertiesToUpdate.priority;
                     }
                     // ... 其他允许的字段
                } else {
                    logWarning(`[API.modifyAreaProperties] Attempted to modify potentially unsafe or unknown property: ${key}`);
                }
            }
        }
    }


    // --- 保存更改 ---
    if (saveAreaData(areaData)) {
        logInfo(`[API.modifyAreaProperties] 成功修改区域: ${area.name} (ID: ${areaId})`);
        updateAreaData(areaData); // 更新内存和空间索引
        return { success: true, updatedArea: area };
    } else {
        logError(`[API.modifyAreaProperties] 保存区域数据失败: ${area.name} (ID: ${areaId})`);
        // 回滚内存中的更改
        areaData[areaId] = originalAreaBackup;
        return { success: false, message: "保存区域数据失败" };
    }
}


/**
 * API 函数：通过坐标获取重叠的区域
 * @param {object} pos - 位置对象 {x, y, z, dimid}
 * @returns {Array<object>} 包含重叠区域完整数据对象的数组，按优先级排序 (深度大的优先)
 */
function getAreasByCoords(pos) {
    logDebug(`[API.getAreasByCoords] Received request for position: ${JSON.stringify(pos)}`);
    if (!pos || pos.x === undefined || pos.y === undefined || pos.z === undefined || pos.dimid === undefined) {
        logWarning("[API.getAreasByCoords] Invalid position object provided.");
        return [];
    }
    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex();
    const areasInfo = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

    // areasInfo 包含 {id, area, isSubarea, parentAreaId, depth}
    // 我们只需要返回 area 对象本身 (确保 area 存在)
    return areasInfo.map(info => info.area).filter(area => !!area);
}

/**
 * API 函数：访问插件配置文件的某个配置项的值
 * @param {string} keyPath - 配置项的路径，用点分隔，例如 "economy.enabled" 或 "bsci.mainAreaColor.r"
 * @param {*} [defaultValue=null] - 如果找不到配置项，返回的默认值
 * @returns {*} 配置项的值，或默认值
 */
function getConfigValue(keyPath, defaultValue = null) {
    logDebug(`[API.getConfigValue] Received request for keyPath: ${keyPath}`);
    if (!keyPath || typeof keyPath !== 'string') {
        logWarning("[API.getConfigValue] Invalid keyPath provided.");
        return defaultValue;
    }

    const config = loadConfig(); // 加载当前配置
    const keys = keyPath.split('.');
    let current = config;

    for (const key of keys) {
        if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, key)) { // 更安全的检查
            current = current[key];
        } else {
            logDebug(`[API.getConfigValue] Key "${key}" not found in path "${keyPath}". Returning default value.`);
            return defaultValue; // 路径无效或找不到键
        }
    }

    logDebug(`[API.getConfigValue] Found value for "${keyPath}": ${JSON.stringify(current)}`);
    // 如果找到的值是 undefined，也返回 defaultValue
    return current === undefined ? defaultValue : current;
}

// --- API 导出 ---
const czAreaProtectionAPI_v1 = {
    createArea,
    modifyAreaProperties,
    getAreasByCoords,
    getConfigValue,
    // --- 从 utils.js 导出的辅助函数 ---
    checkNewAreaOverlap, // 检查新区域与现有区域的重叠
    checkAreaSizeLimits, // 检查区域大小是否符合配置限制
    isAreaWithinArea,    // 检查区域A是否完全在区域B内部
    // ---------------------------------
    // 可以考虑添加其他有用的 API，例如：
    // getAreaById: (areaId) => getAreaData()[areaId] || null,
    // deleteArea: (areaId) => { /* 实现删除逻辑 */ },
    // checkPermission: (player, areaId, permission) => { /* 实现权限检查 */ }
};

// 使用 ll.exports 导出 API
// 命名空间可以自定义，建议包含插件名和版本号
const namespace = "czAreaProtectionAPI";
const exportName = "v1"; // API 版本号

const exported = ll.exports(czAreaProtectionAPI_v1, namespace, exportName);

if (exported) {
    logInfo(`czAreaProtection API (${namespace}.${exportName}) 导出成功!`);
} else {
    logError(`czAreaProtection API (${namespace}.${exportName}) 导出失败! 可能存在命名冲突。`);
}

// 也可以导出模块本身，但不推荐直接修改内部状态
// module.exports = czAreaProtectionAPI_v1;
