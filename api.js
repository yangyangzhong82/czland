// api.js - Defines API functions for external use.
// API export logic is handled in apiExports.js

const { getPlayerPermissionCached, getCustomGroupCached } = require('./permission'); // Import necessary functions

/**
 * 获取玩家在指定区域的权限组名称
 * @param {string} playerUuid 玩家 UUID
 * @param {string} areaId 区域 ID
 * @returns {string | null} 权限组名称，如果玩家在该区域没有特定权限组，则返回 null
 */
function getPlayerAreaGroup(playerUuid, areaId) {
    // 直接使用缓存函数获取
    return getPlayerPermissionCached(playerUuid, areaId);
}

/**
 * 获取指定自定义权限组的权限列表
 * @param {string} groupName 权限组名称 (原始名称)
 * @param {string} creatorUuid 创建者 UUID
 * @returns {string[] | null} 权限 ID 数组，如果组不存在则返回 null
 */
function getGroupPermissions(groupName, creatorUuid) {
    // 使用缓存函数获取组详情
    const groupDetails = getCustomGroupCached(creatorUuid, groupName);
    if (groupDetails && Array.isArray(groupDetails.permissions)) {
        return groupDetails.permissions;
    }
    // 如果组不存在或权限数据无效，返回 null
    return null;
}

/**
 * 获取指定区域的详细数据。
 * @param {string} areaId - 要查询的区域的ID。
 * @returns {object | null} - 返回区域的数据对象，如果区域不存在则返回 null。
 */
function getAreaInfo(areaId) {
    const areaData = getAreaData(); // 获取所有区域数据
    if (areaData && areaData[areaId]) {
        // 返回指定区域数据的深拷贝，防止外部修改影响内部数据
        return JSON.parse(JSON.stringify(areaData[areaId]));
    } else {
        logDebug(`[API] 未找到区域 ID: ${areaId}`);
        return null; // 区域不存在
    }
}

// Export the functions so they can be required by apiExports.js

// --- Area Management API Functions ---

const { getAreaData, updateAreaData } = require('./czareaprotection'); // Import area data functions
const { saveAreaData } = require('./config'); // Import save function
const { loadConfig } = require('./configManager'); // Import config loader
const {
    generateAreaId, // Assuming generateAreaId is moved or accessible here, otherwise define it
    checkAreaSizeLimits,
    checkNewAreaOverlap,
    calculatePlayerTotalAreaSize,
    calculateAreaVolume,
    isAreaWithinArea,
    countPlayerAreas
} = require('./utils'); // Import utility functions
const {
    calculateAreaPrice,
    handleAreaPurchase,
    getPlayerBalance,
    reducePlayerBalance,
    addPlayerBalance,
    handleAreaRefund
} = require('./economy'); // Import economy functions
const { checkPermission } = require('./permission'); // Import permission check
const { isAreaAdmin } = require('./areaAdmin'); // Import admin check
const { logDebug, logInfo, logWarning, logError } = require('./logger'); // Import logger

// Helper to generate ID if not imported from utils
function _generateAreaId() {
    return 'area_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}


/**
 * 创建一个新区域。
 * @param {Player} creatorPlayer - 创建区域的玩家对象。
 * @param {string} areaName - 新区域的期望名称。
 * @param {object} point1 - 第一个角点坐标 {x, y, z, dimid}。
 * @param {object} point2 - 第二个角点坐标 {x, y, z, dimid}。
 * @param {string} [parentAreaId=null] - 可选的父区域ID（如果创建的是子区域）。
 * @returns {Promise<{success: boolean, areaId?: string, error?: string}>} - 包含操作结果的对象，成功时包含 areaId，失败时包含 error 信息。
 */
async function createArea(creatorPlayer, areaName, point1, point2, parentAreaId = null) {
    logInfo(`[API] 玩家 ${creatorPlayer.name} 尝试创建区域 "${areaName}"`);
    const config = loadConfig();
    const areaData = getAreaData(); // 获取当前区域数据
    const economyConfig = config.economy;

    // --- 验证输入 ---
    if (!areaName || typeof areaName !== 'string' || areaName.trim() === "") {
        return { success: false, error: "区域名称不能为空" };
    }
    if (!point1 || !point2 || point1.dimid === undefined || point1.dimid !== point2.dimid) {
        return { success: false, error: "无效的坐标点或点不在同一维度" };
    }
    const isSubarea = parentAreaId !== null; // 判断是否为子区域
    const parentArea = isSubarea ? areaData[parentAreaId] : null; // 获取父区域数据
    if (isSubarea && !parentArea) {
        return { success: false, error: `父区域 ID "${parentAreaId}" 不存在` };
    }

    // 确保点坐标顺序正确 (p1 为最小值点, p2 为最大值点)
    const p1 = {
        x: Math.min(point1.x, point2.x),
        y: Math.min(point1.y, point2.y),
        z: Math.min(point1.z, point2.z),
        dimid: point1.dimid
    };
    const p2 = {
        x: Math.max(point1.x, point2.x),
        y: Math.max(point1.y, point2.y),
        z: Math.max(point1.z, point2.z),
        dimid: point1.dimid
    };
    const newAreaTemp = { point1: p1, point2: p2, dimid: p1.dimid }; // 用于检查的临时区域对象


    // --- 限制检查 ---
    // 区域数量限制 (仅主区域, 管理员忽略)
    if (!isSubarea && !isAreaAdmin(creatorPlayer.uuid) && config.maxAreasPerPlayer !== -1) {
        const ownedAreas = countPlayerAreas(creatorPlayer.xuid, areaData);
        if (ownedAreas >= config.maxAreasPerPlayer) {
            return { success: false, error: `你已达到最大区域数量限制 (${config.maxAreasPerPlayer})` };
        }
    }
    // 区域尺寸限制
    const sizeCheck = checkAreaSizeLimits(p1, p2, config, isSubarea);
    if (!sizeCheck.valid) {
        return { success: false, error: `区域大小无效: ${sizeCheck.message}` };
    }
    // 总区域大小限制 (仅主区域, 管理员忽略)
    if (!isSubarea && !isAreaAdmin(creatorPlayer.uuid) && config.maxTotalAreaSizePerPlayer > 0) {
        const currentTotalSize = calculatePlayerTotalAreaSize(creatorPlayer.xuid, areaData);
        const newAreaVolume = calculateAreaVolume(newAreaTemp);
        if (currentTotalSize + newAreaVolume > config.maxTotalAreaSizePerPlayer) {
            return { success: false, error: `创建后总区域大小将超过限制 (${currentTotalSize + newAreaVolume} > ${config.maxTotalAreaSizePerPlayer})` };
        }
    }
    // 区域重叠检查
    const overlapCheck = checkNewAreaOverlap(newAreaTemp, areaData, isSubarea ? parentAreaId : null); // 如果是子区域，检查时不考虑其父区域
    if (overlapCheck.overlapped) {
        return { success: false, error: `无法创建区域：与现有区域 "${overlapCheck.overlappingArea.name}" 重叠` };
    }
    // 子区域范围检查 (必须在父区域内)
    if (isSubarea && parentArea) {
        if (!isAreaWithinArea(newAreaTemp, parentArea)) {
            return { success: false, error: "子区域必须完全在父区域内" };
        } // Corrected indentation/placement
    }
    // --- 经济系统处理 ---
    let finalPrice = 0;
    if (!isSubarea && economyConfig.enabled) { // 子区域通常免费
        finalPrice = calculateAreaPrice(p1, p2); // calculateAreaPrice 内部会使用加载的配置
        const purchaseSuccess = await handleAreaPurchase(creatorPlayer, p1, p2); // handleAreaPurchase 处理余额检查和扣费
        if (!purchaseSuccess) {
            // 错误信息已在 handleAreaPurchase 中提示给玩家
            return { success: false, error: "经济交易失败" }; // 返回通用错误信息
        }
    }

    // --- 创建区域数据 ---
    const areaId = _generateAreaId(); // 使用内部辅助函数或导入的函数生成ID
    const newAreaData = {
        name: areaName.trim(),
        point1: p1,
        point2: p2,
        dimid: p1.dimid,
        xuid: creatorPlayer.xuid,
        uuid: creatorPlayer.uuid,
        createTime: Date.now(),
        price: finalPrice, // 存储计算出的价格 (主区域)
        isSubarea: isSubarea,
        parentAreaId: parentAreaId,
        priority: isSubarea ? (parentArea.priority || 0) + 1 : 0, // 子区域优先级基于父区域
        rules: {}, // 初始化空规则对象
        // 为主区域添加 subareas 属性
        ...(isSubarea ? {} : { subareas: {} })
    };

    // 如果是子区域，将其ID添加到父区域的 subareas 列表中
    if (isSubarea && parentArea) {
        if (!parentArea.subareas) {
            parentArea.subareas = {};
        }
        parentArea.subareas[areaId] = true; // 在父区域中存储子区域的引用
    }

    // --- 保存与更新 ---
    const currentAreaData = { ...areaData }; // 创建 areaData 的可变副本
    currentAreaData[areaId] = newAreaData; // 添加新区域
    if (isSubarea && parentArea) {
        currentAreaData[parentAreaId] = parentArea; // 确保父区域的 subareas 更新也被保存
    }


    if (saveAreaData(currentAreaData)) {
        logInfo(`[API] 区域 "${areaName}" (ID: ${areaId}) 由 ${creatorPlayer.name} 创建成功`);
        updateAreaData(currentAreaData); // 更新内存中的区域数据
        // 可选: 触发玩家区域检查? checkPlayerCallback(creatorPlayer);
        return { success: true, areaId: areaId };
    } else {
        logError(`[API] 创建区域 ${areaId} 后保存区域数据失败`);
        // 尝试回滚经济操作？这比较复杂。
        // 目前仅报告保存失败。
        return { success: false, error: "区域创建成功但保存失败，请检查日志" };
    }
}


/**
 * 修改一个已存在的区域。
 * @param {Player} modifierPlayer - 执行修改操作的玩家对象。
 * @param {string} areaId - 要修改的区域的ID。
 * @param {object} modifications - 包含修改内容的对象。键可以是:
 *   - name: {string} 新名称
 *   - point1: {object} 新的角点1 {x, y, z} (必须同时提供 point2)
 *   - point2: {object} 新的角点2 {x, y, z} (必须同时提供 point1)
 *   - rules: {object} 新的规则对象 (将完全替换旧规则)
 *   - owner: {object} 新的所有者数据 {uuid, xuid, name}
 *   - priority: {number} 新的优先级数值
 * @returns {Promise<{success: boolean, error?: string}>} - 包含操作结果的对象。
 */
async function modifyArea(modifierPlayer, areaId, modifications) {
    logInfo(`[API] 玩家 ${modifierPlayer.name} 尝试修改区域 ${areaId}，修改内容: ${JSON.stringify(modifications)}`);
    const config = loadConfig();
    const areaData = getAreaData(); // 获取最新区域数据
    const economyConfig = config.economy;
    const area = areaData[areaId]; // 获取要修改的区域

    if (!area) {
        return { success: false, error: "区域不存在" };
    }

    // 创建区域数据的深拷贝，用于比较或潜在的回滚
    const originalArea = JSON.parse(JSON.stringify(area));
    let changesMade = false; // 标记是否有实际修改发生
    let errorOccurred = null; // 用于记录处理过程中的错误

    // --- 处理各项修改 ---

    // 修改名称 (Rename)
    if (modifications.name !== undefined) {
        // 权限检查
        if (!checkPermission(modifierPlayer, areaData, areaId, "rename")) {
            return { success: false, error: "无权限修改区域名称" };
        }
        const newName = String(modifications.name).trim();
        if (!newName) {
            return { success: false, error: "区域名称不能为空" };
        }
        area.name = newName; // 更新名称
        changesMade = true;
        logDebug(`[API Modify ${areaId}] 名称修改为 "${newName}"`);
    }

    // 修改范围 (Resize) - 必须同时提供 point1 和 point2
    if (modifications.point1 !== undefined && modifications.point2 !== undefined) {
        // 权限检查
        if (!checkPermission(modifierPlayer, areaData, areaId, "resizeArea")) {
            return { success: false, error: "无权限修改区域范围" };
        }
        const p1Raw = modifications.point1;
        const p2Raw = modifications.point2;
        const dimid = area.dimid; // 假设在同一维度调整

        // 验证坐标点
        if (!p1Raw || !p2Raw || p1Raw.x === undefined || p1Raw.y === undefined || p1Raw.z === undefined ||
            p2Raw.x === undefined || p2Raw.y === undefined || p2Raw.z === undefined) {
            return { success: false, error: "无效的新坐标点" };
        }

        // 确保坐标顺序
        const p1 = { x: Math.min(p1Raw.x, p2Raw.x), y: Math.min(p1Raw.y, p2Raw.y), z: Math.min(p1Raw.z, p2Raw.z), dimid: dimid };
        const p2 = { x: Math.max(p1Raw.x, p2Raw.x), y: Math.max(p1Raw.y, p2Raw.y), z: Math.max(p1Raw.z, p2Raw.z), dimid: dimid };
        const newAreaTemp = { point1: p1, point2: p2, dimid: dimid }; // 临时区域对象

        // 尺寸限制检查
        const sizeCheck = checkAreaSizeLimits(p1, p2, config, area.isSubarea);
        if (!sizeCheck.valid) {
            return { success: false, error: `区域大小无效: ${sizeCheck.message}` };
        }
        // 子区域范围检查
        if (area.isSubarea && area.parentAreaId) {
            const parentArea = areaData[area.parentAreaId];
            if (parentArea && !isAreaWithinArea(newAreaTemp, parentArea)) {
                return { success: false, error: "子区域必须完全在父区域内" };
            }
        }
        // 重叠检查 (排除自身, 父区域, 子区域)
        const areasToCheck = {};
        for (let id in areaData) {
            if (id === areaId) continue; // 排除自己
            if (area.isSubarea && id === area.parentAreaId) continue; // 排除父区域（如果是子区域）
            if (!area.isSubarea && area.subareas && area.subareas[id]) continue; // 排除子区域（如果是主区域）
            areasToCheck[id] = areaData[id];
        }
        const overlapCheck = checkNewAreaOverlap(newAreaTemp, areasToCheck);
        if (overlapCheck.overlapped) {
            return { success: false, error: `无法调整区域范围：与现有区域 "${overlapCheck.overlappingArea.name}" 重叠` };
        }
        // 总大小限制检查 (仅主区域, 管理员忽略)
        if (!area.isSubarea && !isAreaAdmin(modifierPlayer.uuid) && config.maxTotalAreaSizePerPlayer > 0) {
            let currentTotalSizeExcludingThis = 0;
            // 计算玩家当前拥有的 *其他* 主区域的总大小
            for (const id in areaData) {
                const otherArea = areaData[id];
                if (id !== areaId && otherArea.xuid === modifierPlayer.xuid && !otherArea.isSubarea) {
                    currentTotalSizeExcludingThis += calculateAreaVolume(otherArea);
                }
            }
            const newAreaVolume = calculateAreaVolume(newAreaTemp); // 计算新范围的体积
            // 检查调整后的总大小是否超限
            if (currentTotalSizeExcludingThis + newAreaVolume > config.maxTotalAreaSizePerPlayer) {
                return { success: false, error: `调整后总区域大小将超过限制 (${currentTotalSizeExcludingThis + newAreaVolume} > ${config.maxTotalAreaSizePerPlayer})` };
            }
        }

        // 经济系统处理 (调整范围)
        let priceDifference = 0;
        let newPrice = area.price; // 如果经济系统禁用，价格保持不变
        if (!area.isSubarea && economyConfig.enabled) { // 子区域调整通常免费
            const originalPrice = area.price || calculateAreaPrice(originalArea.point1, originalArea.point2); // 获取或计算原价
            newPrice = calculateAreaPrice(p1, p2); // 计算新价格
            priceDifference = newPrice - originalPrice; // 计算差价

            if (priceDifference > 0) { // 新区域更大，需要付费
                const playerBalance = await getPlayerBalance(modifierPlayer); // 异步获取余额
                if (playerBalance < priceDifference) {
                    return { success: false, error: `余额不足，需要额外支付 ${priceDifference}` };
                }
                if (!await reducePlayerBalance(modifierPlayer, priceDifference)) { // 异步扣款
                    return { success: false, error: "扣除额外费用失败" };
                }
                logDebug(`[API Modify ${areaId}] 因调整范围支付 ${priceDifference}`);
            } else if (priceDifference < 0) { // 新区域更小，退款
                if (!await addPlayerBalance(modifierPlayer, Math.abs(priceDifference))) { // 异步退款
                    logWarning(`[API Modify ${areaId}] 因调整范围退款 ${Math.abs(priceDifference)} 失败`);
                    // 即使退款失败，是否继续修改？目前选择继续。
                } else {
                    logDebug(`[API Modify ${areaId}] 因调整范围退款 ${Math.abs(priceDifference)}`);
                }
            }
        }

        // 应用修改
        area.point1 = p1;
        area.point2 = p2;
        area.price = newPrice; // 更新价格 (即使经济系统禁用也可能更新为0)
        changesMade = true;
        logDebug(`[API Modify ${areaId}] 范围已调整`);
    } else if (modifications.point1 !== undefined || modifications.point2 !== undefined) {
        // 如果只提供了 point1 或 point2 中的一个，则报错
        return { success: false, error: "修改区域范围必须同时提供 point1 和 point2" };
    }


    // 设置规则 (Set Rules)
    if (modifications.rules !== undefined) {
        // 权限检查
        if (!checkPermission(modifierPlayer, areaData, areaId, "setAreaRules")) {
            return { success: false, error: "无权限设置区域规则" };
        }
        // 验证规则数据类型
        if (typeof modifications.rules !== 'object' || modifications.rules === null) {
            return { success: false, error: "无效的规则数据" };
        }
        area.rules = { ...modifications.rules }; // 完全替换旧规则
        changesMade = true;
        logDebug(`[API Modify ${areaId}] 规则已更新`);
    }

    // 转让所有者 (Transfer Owner)
    if (modifications.owner !== undefined) {
        // 权限检查
        if (!checkPermission(modifierPlayer, areaData, areaId, "transferArea")) {
            return { success: false, error: "无权限转让此区域" };
        }
        const newOwner = modifications.owner;
        // 验证新所有者数据结构
        if (!newOwner || typeof newOwner !== 'object' || !newOwner.uuid || !newOwner.xuid || !newOwner.name) {
            return { success: false, error: "无效的新主人数据" };
        }
        // 不能转让给自己
        if (newOwner.uuid === area.uuid) {
             return { success: false, error: "不能将区域转让给自己" };
        }

        // 检查接收方的总大小限制 (仅主区域)
        if (!area.isSubarea && !isAreaAdmin(newOwner.uuid) && config.maxTotalAreaSizePerPlayer > 0) {
            const receiverCurrentTotalSize = calculatePlayerTotalAreaSize(newOwner.xuid, areaData);
            const areaToTransferSize = calculateAreaVolume(area);
            if (receiverCurrentTotalSize + areaToTransferSize > config.maxTotalAreaSizePerPlayer) {
                return { success: false, error: `无法转让：接收方 ${newOwner.name} 的总区域大小将超过其限制` };
            }
        }

        // 更新所有者信息
        area.uuid = newOwner.uuid;
        area.xuid = newOwner.xuid;
        area.playerName = newOwner.name; // 可选地存储玩家名称
        changesMade = true;
        logDebug(`[API Modify ${areaId}] 所有者已转让给 ${newOwner.name} (${newOwner.uuid})`);
    }

    // 设置优先级 (Set Priority) - 示例
    if (modifications.priority !== undefined) {
        // 可选：添加权限检查，例如: if (!checkPermission(modifierPlayer, areaData, areaId, "setPriority")) ...
        const newPriority = parseInt(modifications.priority, 10);
        if (isNaN(newPriority)) {
            return { success: false, error: "无效的优先级数值" };
        }
        // 可能需要添加更复杂的逻辑来重新排序同级区域的优先级
        area.priority = newPriority;
        changesMade = true;
        logDebug(`[API Modify ${areaId}] 优先级设置为 ${newPriority}`);
    }


    // --- 保存与更新 ---
    if (changesMade) { // 只有在实际发生修改时才保存
        const currentAreaData = { ...areaData }; // 创建可变副本
        currentAreaData[areaId] = area; // 将修改后的区域放回副本

        if (saveAreaData(currentAreaData)) { // 保存整个更新后的 areaData
            logInfo(`[API] 区域 ${areaId} 由 ${modifierPlayer.name} 修改成功`);
            updateAreaData(currentAreaData); // 更新内存中的数据
            return { success: true };
        } else {
            logError(`[API] 修改区域 ${areaId} 后保存区域数据失败`);
            // 尝试回滚修改？这很困难。
            return { success: false, error: "区域修改成功但保存失败，请检查日志" };
        }
    } else {
        logInfo(`[API] 未对区域 ${areaId} 应用任何修改`);
        return { success: true }; // 没有请求或需要进行的修改
    }
}
module.exports = {
    getPlayerAreaGroup,
    getGroupPermissions,
    createArea, // Export new function
    modifyArea,  // Export new function
    getAreaInfo // Export new function
};
