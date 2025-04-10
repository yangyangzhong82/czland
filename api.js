// api.js - Defines API functions for external use.
// API export logic is handled in apiExports.js

const { getPlayerPermissionCached, getCustomGroupCached, groupHasPermission, getAvailableGroups } = require('./permission'); // Import necessary functions

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
 * @param {string} uniqueGroupId 权限组的唯一标识符 ("组名_创建者UUID")
 * @returns {string[] | null} 权限 ID 数组，如果组不存在或标识符无效则返回 null
 */
function getGroupPermissions(uniqueGroupId) {
    if (typeof uniqueGroupId !== 'string' || !uniqueGroupId.includes('_')) {
        logError(`[API getGroupPermissions] 无效的 uniqueGroupId: ${uniqueGroupId}`);
        return null;
    }
    const parts = uniqueGroupId.split('_');
    if (parts.length < 2) {
        logError(`[API getGroupPermissions] 无法从 uniqueGroupId 解析 groupName 和 creatorUuid: ${uniqueGroupId}`);
        return null;
    }
    const creatorUuid = parts.pop(); // 最后一部分是 UUID
    const groupName = parts.join('_'); // 前面的部分（可能包含下划线）是组名

    // 使用缓存函数获取组详情
    const groupDetails = getCustomGroupCached(creatorUuid, groupName);
    if (groupDetails && Array.isArray(groupDetails.permissions)) {
        return groupDetails.permissions; // 返回权限数组
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
    // Moved require here to avoid circular dependency
    const { getAreaData } = require('./czareaprotection');
    const { logDebug } = require('./logger'); // Ensure logger is available if needed

    const areaData = getAreaData(); // 获取所有区域数据
    if (areaData && areaData[areaId]) {
        return JSON.parse(JSON.stringify(areaData[areaId]));
    } else {
        logDebug(`[API] 未找到区域 ID: ${areaId}`);
        return null; // 区域不存在
    }
}

// Export the functions so they can be required by apiExports.js

// --- Area Management API Functions ---

// Note: require('./czareaprotection') moved into functions below to avoid circular dependency
const { saveAreaData } = require('./config'); // Import save function
const { loadConfig } = require('./configManager'); // Import config loader
const {
    // generateAreaId is defined locally as _generateAreaId
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
    // Moved require here to avoid circular dependency
    const { getAreaData, updateAreaData } = require('./czareaprotection');

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
    const { getAreaData, updateAreaData } = require('./czareaprotection');

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


/**
 * [内部] 根据提供的数据创建一个新区域，用于数据迁移,专门用于iland迁移等场景。
 * 跳过玩家对象相关的检查（权限、经济、玩家限制）。
 * @param {string} ownerXuid 区域所有者的 XUID。
 * @param {string | null} ownerUuid 区域所有者的 UUID (如果可用，否则为 null)。
 * @param {string} areaName 新区域的名称。
 * @param {object} point1 第一个角点坐标 {x, y, z}。
 * @param {object} point2 第二个角点坐标 {x, y, z}。
 * @param {number} dimid 区域所在的维度 ID。
 * @param {object | null} teleportData 可选的传送点数据 {x, y, z} (来自旧数据)。
 * @returns {{success: boolean, areaId?: string, error?: string}} 操作结果。
 */
function _internal_createAreaFromData(ownerXuid, ownerUuid, areaName, point1, point2, dimid, teleportData = null) {
    // Moved require here to avoid circular dependency
    const { getAreaData, updateAreaData } = require('./czareaprotection');

    logInfo(`[API Internal] 尝试通过数据迁移创建区域 "${areaName}" (所有者 XUID: ${ownerXuid})`);
    const config = loadConfig();
    const areaData = getAreaData(); // 获取当前区域数据

    // --- 验证输入 ---
    if (!areaName || typeof areaName !== 'string' || areaName.trim() === "") {
        areaName = `区域_${ownerXuid}_${Date.now()}`; // 提供一个默认名称
        logWarning(`[API Internal] 区域名称无效，使用默认名称: ${areaName}`);
    }
     if (!ownerXuid) {
        return { success: false, error: "所有者 XUID 不能为空" };
    }
    if (!point1 || !point2 || dimid === undefined || dimid === null) {
        return { success: false, error: "无效的坐标点或维度 ID" };
    }
    // 确保点坐标顺序正确 (p1 为最小值点, p2 为最大值点)
    const p1 = {
        x: Math.min(point1.x, point2.x),
        y: Math.min(point1.y, point2.y),
        z: Math.min(point1.z, point2.z),
        dimid: dimid // 使用传入的 dimid
    };
    const p2 = {
        x: Math.max(point1.x, point2.x),
        y: Math.max(point1.y, point2.y),
        z: Math.max(point1.z, point2.z),
        dimid: dimid // 使用传入的 dimid
    };
    const newAreaTemp = { point1: p1, point2: p2, dimid: p1.dimid }; // 用于检查的临时区域对象

    // --- 限制检查 (简化版，跳过玩家特定限制和尺寸限制) ---
    // 区域尺寸限制 (迁移时跳过)
    /*
    const sizeCheck = checkAreaSizeLimits(p1, p2, config, false); // 假设迁移的是主区域
    if (!sizeCheck.valid) {
        logError(`[API Internal] 区域 "${areaName}" (所有者: ${ownerXuid}) 尺寸无效: ${sizeCheck.message}，但迁移时将忽略此限制。`);
        // return { success: false, error: `区域大小无效: ${sizeCheck.message}` }; // 注释掉以忽略限制
    }
    */
    // 区域重叠检查 (仍然需要检查)
    const overlapCheck = checkNewAreaOverlap(newAreaTemp, areaData, null); // 检查是否与任何现有区域重叠
    if (overlapCheck.overlapped) {
        // 检查重叠区域是否与当前尝试创建的区域数据完全一致（可能是重复迁移）
        const existing = overlapCheck.overlappingArea;
        if (existing.xuid === ownerXuid &&
            existing.name === areaName.trim() &&
            existing.point1.x === p1.x && existing.point1.y === p1.y && existing.point1.z === p1.z &&
            existing.point2.x === p2.x && existing.point2.y === p2.y && existing.point2.z === p2.z &&
            existing.dimid === p1.dimid) {
            logWarning(`[API Internal] 区域 "${areaName}" (ID: ${overlapCheck.overlappingAreaId}) 已存在且数据匹配，跳过重复创建。`);
            return { success: true, areaId: overlapCheck.overlappingAreaId, message: "区域已存在，跳过创建" };
        } else {
            logError(`[API Internal] 无法创建区域 "${areaName}"：与现有区域 "${existing.name}" (ID: ${overlapCheck.overlappingAreaId}) 重叠，且数据不完全匹配。`);
         return { success: false, error: `无法创建区域：与现有区域 "${existing.name}" 重叠` };
        }
    }

    // --- 处理 2D 区域 Y 坐标 ---
    // 假设 2D 区域在旧数据中使用 -64 到 320 的 Y 范围
    const minY = -64;
    const maxY = 320;
    let finalP1 = { ...p1 }; // 创建副本以修改
    let finalP2 = { ...p2 };

    if ((p1.y === minY && p2.y === maxY) || (p1.y === maxY && p2.y === minY)) {
        logDebug(`[API Internal] 检测到可能的 2D 区域 (Y 范围 ${minY}-${maxY})，将强制设置为全高度。`);
        finalP1.y = minY;
        finalP2.y = maxY;
    } else {
        logDebug(`[API Internal] 处理为 3D 区域，Y 范围: ${p1.y} - ${p2.y}`);
    }


    // --- 创建区域数据 ---
    const areaId = _generateAreaId(); // 生成新 ID
    const newAreaData = {
        name: areaName.trim(),
        point1: finalP1, // 使用可能调整过 Y 坐标的 p1
        point2: finalP2, // 使用可能调整过 Y 坐标的 p2
        dimid: finalP1.dimid, // dimid 不变
        xuid: ownerXuid,
        uuid: ownerUuid || null, // 使用提供的 UUID 或 null
        createTime: Date.now(),
        price: 0, // 迁移的区域价格设为 0
        isSubarea: false, // 假设迁移的是主区域
        parentAreaId: null,
        priority: 0, // 默认优先级
        rules: {}, // 初始化空规则对象
        subareas: {} // 主区域需要 subareas 属性
    };

    // 处理传送点数据
    if (teleportData && Array.isArray(teleportData) && teleportData.length === 3) {
        newAreaData.teleportPoint = {
            x: teleportData[0],
            y: teleportData[1],
            z: teleportData[2],
            dimid: finalP1.dimid, // 使用区域的维度
            yaw: 0,         // 默认 Yaw
            pitch: 0        // 默认 Pitch
        };
        logDebug(`[API Internal] 为区域 ${areaId} 设置了迁移的传送点: ${JSON.stringify(newAreaData.teleportPoint)}`);
    }


    // --- 保存与更新 ---
    const currentAreaData = { ...areaData }; // 创建 areaData 的可变副本
    currentAreaData[areaId] = newAreaData; // 添加新区域

    if (saveAreaData(currentAreaData)) {
        logInfo(`[API Internal] 区域 "${areaName}" (ID: ${areaId}) 通过数据迁移创建成功`);
        updateAreaData(currentAreaData); // 更新内存中的区域数据
        return { success: true, areaId: areaId };
    } else {
        logError(`[API Internal] 创建区域 ${areaId} 后保存区域数据失败`);
        return { success: false, error: "区域创建成功但保存失败，请检查日志" };
    }
}

/**
 * 检查指定的自定义权限组是否包含特定权限。
 * @param {string} groupName 权限组名称 (原始名称)
 * @param {string} uniqueGroupId 权限组的唯一标识符 ("组名_创建者UUID")
 * @param {string} permissionId 要检查的权限 ID
 * @returns {boolean} 如果组存在且包含该权限，则返回 true，否则返回 false。如果标识符无效则返回 false。
 */
function checkGroupPermission(uniqueGroupId, permissionId) {
    if (typeof uniqueGroupId !== 'string' || !uniqueGroupId.includes('_')) {
        logError(`[API checkGroupPermission] 无效的 uniqueGroupId: ${uniqueGroupId}`);
        return false;
    }
    const parts = uniqueGroupId.split('_');
     if (parts.length < 2) {
        logError(`[API checkGroupPermission] 无法从 uniqueGroupId 解析 groupName 和 creatorUuid: ${uniqueGroupId}`);
        return false;
    }
    const creatorUuid = parts.pop(); // 最后一部分是 UUID
    const groupName = parts.join('_'); // 前面的部分（可能包含下划线）是组名

    // 直接调用 permission.js 中的核心逻辑
    return groupHasPermission(creatorUuid, groupName, permissionId);
}

/**
 * 获取所有可用的自定义权限组的唯一标识符列表。
 * @returns {string[]} 格式: ["组名1_创建者UUID1", "组名2_创建者UUID2", ...]
 */
function getAvailablePermissionGroups() {
    return getAvailableGroups();
}


module.exports = {
    getPlayerAreaGroup,
    getGroupPermissions,
    getAvailablePermissionGroups, // 导出新的 API 函数
    checkGroupPermission, // 导出新的 API 函数
    _internal_createAreaFromData, // Export new internal function
    createArea, // Export new function
    modifyArea,  // Export new function
    getAreaInfo, // Export new function
    deleteArea, // Export new function
    getAreasByOwner, // Export new function
    getAreaAtPosition, // Export new function
    getAllAreaIds, // Export new function
    checkAreaPermission, // Export new wrapper function
    getAreasByOwnerUuid // Export new function for UUID query
};

// --- New API Functions ---

/**
 * 删除一个区域。
 * @param {Player | string} deleter - 执行删除操作的玩家对象或其 UUID。
 * @param {string} areaId - 要删除的区域的 ID。
 * @param {boolean} [force=false] - 是否强制删除 (例如，忽略子区域检查，需要特殊权限)。
 * @returns {Promise<{success: boolean, refundedAmount?: number, error?: string}>} - 操作结果。
 */
async function deleteArea(deleter, areaId, force = false) {
    // Moved require here to avoid circular dependency
    const { getAreaData, updateAreaData } = require('./czareaprotection');
    const { checkPermission } = require('./permission'); // Import permission check
    const { handleAreaRefund } = require('./economy'); // Import economy functions
    const { saveAreaData } = require('./config'); // Import save function
    const { loadConfig } = require('./configManager'); // Import config loader
    const { logInfo, logWarning, logError } = require('./logger'); // Import logger
    const { isAreaAdmin } = require('./areaAdmin'); // Import admin check

    const config = loadConfig();
    const areaData = getAreaData();
    const area = areaData[areaId];

    if (!area) {
        return { success: false, error: "区域不存在" };
    }

    // --- 权限检查 ---
    let deleterPlayer = null;
    let deleterUuid = null;
    if (typeof deleter === 'object' && deleter && deleter.uuid) {
        deleterPlayer = deleter;
        deleterUuid = deleter.uuid;
    } else if (typeof deleter === 'string') {
        deleterUuid = deleter; // Assume it's UUID
    } else {
        return { success: false, error: "无效的删除者信息 (需要 Player 对象或 UUID)" };
    }

    // checkPermission needs player object or UUID, areaData, areaId, permissionId
    const hasPermission = checkPermission(deleterPlayer || deleterUuid, areaData, areaId, "delete");
    if (!hasPermission) {
        return { success: false, error: "无权限删除此区域" };
    }

    logInfo(`[API] ${deleterPlayer ? deleterPlayer.name : `用户(${deleterUuid})`} 尝试删除区域 ${areaId}`);

    // --- 子区域检查 ---
    if (!area.isSubarea && area.subareas && Object.keys(area.subareas).length > 0 && !force) {
        return { success: false, error: "无法删除：该区域包含子区域。请先删除子区域或使用强制删除选项。" };
    }
    // 强制删除需要管理员权限
    if (force && !isAreaAdmin(deleterUuid)) {
         return { success: false, error: "无权限强制删除包含子区域的区域" };
    }

    // --- 经济退款 (仅主区域) ---
    let refundedAmount = 0;
    if (!area.isSubarea && config.economy.enabled && config.economy.refundOnDelete) {
        // handleAreaRefund uses the 'player' parameter mainly for sending messages back to the deleter.
        // The actual refund target (owner) is determined from the 'area' object's xuid/uuid inside handleAreaRefund.
        // We can still attempt the refund even if we only have the deleter's UUID.
        // If deleterPlayer is null, handleAreaRefund might not send a confirmation message, but the refund should proceed.
        try {
            // Pass the deleterPlayer object if available (for messages), otherwise pass null or a placeholder if needed.
            // handleAreaRefund itself should handle the case where the first argument isn't a full Player object gracefully for messaging.
            // Let's assume handleAreaRefund can accept null or just needs the area object for the core refund logic.
            // We'll pass deleterPlayer (which might be null) and the area.
            refundedAmount = await handleAreaRefund(deleterPlayer, area); // Pass deleterPlayer (can be null) and the area object
            // Log the refund attempt result regardless of whether deleterPlayer was present
            logInfo(`[API] 区域 ${areaId} 删除，尝试退款 ${refundedAmount} (基于区域主人信息)`);
        } catch (refundError) {
            logError(`[API] 区域 ${areaId} 删除时调用退款处理失败: ${refundError.message}`);
            // Decide whether to proceed with deletion despite refund failure. Currently proceeding.
        }
    }

    // --- 执行删除 ---
    const currentAreaData = { ...areaData }; // 创建副本

    // 如果是子区域，从父区域的 subareas 中移除
    if (area.isSubarea && area.parentAreaId && currentAreaData[area.parentAreaId]) {
        const parentArea = currentAreaData[area.parentAreaId];
        if (parentArea.subareas && parentArea.subareas[areaId]) {
            delete parentArea.subareas[areaId];
            logDebug(`[API] 从父区域 ${area.parentAreaId} 的 subareas 中移除 ${areaId}`);
        }
    }

    // 如果是强制删除且有子区域，递归或迭代删除子区域 (简单实现：仅记录警告)
    if (force && !area.isSubarea && area.subareas && Object.keys(area.subareas).length > 0) {
        logWarning(`[API] 强制删除区域 ${areaId}，其子区域 (${Object.keys(area.subareas).join(', ')}) 将成为孤立区域，除非手动处理。`);
        // 更完善的实现会递归调用 deleteArea 或直接删除子区域数据
        // for (const subId in area.subareas) {
        //     if (currentAreaData[subId]) {
        //         delete currentAreaData[subId]; // 直接删除子区域数据
        //         logInfo(`[API] 强制删除，子区域 ${subId} 已被移除。`);
        //     }
        // }
    }

    // 从主数据中删除该区域
    delete currentAreaData[areaId];

    // --- 保存与更新 ---
    if (saveAreaData(currentAreaData)) {
        logInfo(`[API] 区域 ${areaId} 已成功删除`);
        updateAreaData(currentAreaData); // 更新内存数据和空间索引
        return { success: true, refundedAmount: refundedAmount };
    } else {
        logError(`[API] 删除区域 ${areaId} 后保存区域数据失败`);
        // 尝试回滚？非常困难。
        return { success: false, error: "区域删除成功但保存失败，请检查日志" };
    }
}

/**
 * 获取指定玩家拥有的所有区域 ID 列表。
 * @param {string} playerXuid - 玩家的 XUID。
 * @returns {string[]} - 区域 ID 数组。
 */
function getAreasByOwner(playerXuid) {
    const { getAreaData } = require('./czareaprotection');
    const areaData = getAreaData();
    const ownedAreas = [];

    for (const areaId in areaData) {
        const area = areaData[areaId];
        if (area.xuid === playerXuid) {
            ownedAreas.push(areaId); // 只添加区域 ID
        }
    }
    return ownedAreas;
}

/**
 * 获取指定坐标点处优先级最高的区域信息。
 * @param {object} position - 坐标对象 {x, y, z, dimid}。
 * @returns {object | null} - 最高优先级的区域数据对象，如果不在任何区域则返回 null。
 */
function getAreaAtPosition(position) {
    const { getAreaData, getSpatialIndex } = require('./czareaprotection');
    const { getPriorityAreasAtPosition } = require('./utils'); // 导入核心逻辑函数

    if (!position || position.x === undefined || position.y === undefined || position.z === undefined || position.dimid === undefined) {
        logError("[API getAreaAtPosition] 无效的位置对象");
        return null;
    }

    const areaData = getAreaData();
    const spatialIndex = getSpatialIndex();

    const areasAtPos = getPriorityAreasAtPosition(position, areaData, spatialIndex);

    if (areasAtPos.length > 0) {
        // getPriorityAreasAtPosition 返回的是排序后的 {id, area, depth, parentAreaId} 结构
        // 返回最优先的区域的完整数据 (深拷贝)
        return JSON.parse(JSON.stringify(areasAtPos[0].area));
    } else {
        return null; // 不在任何区域
    }
}

/**
 * 获取所有区域的 ID 列表。
 * @returns {string[]} - 包含所有区域 ID 的数组。
 */
function getAllAreaIds() {
    const { getAreaData } = require('./czareaprotection');
    const areaData = getAreaData();
    return Object.keys(areaData);
}

/**
 * 检查玩家在指定区域是否拥有特定权限 (API 包装器)。
 * @param {Player | string} player - 玩家对象或其 UUID。
 * @param {string} areaId - 要检查的区域 ID。
 * @param {string} permissionId - 要检查的权限 ID。
 * @returns {boolean} - 是否拥有权限。
 */
function checkAreaPermission(player, areaId, permissionId) {
    const { getAreaData } = require('./czareaprotection');
    const { checkPermission } = require('./permission'); // 导入核心权限检查函数
    const areaData = getAreaData();

    // 直接调用核心检查函数
    return checkPermission(player, areaData, areaId, permissionId);
}

/**
 * 获取指定玩家 UUID 拥有的所有区域 ID 列表。
 * @param {string} playerUuid - 玩家的 UUID。
 * @returns {string[]} - 区域 ID 数组。
 */
function getAreasByOwnerUuid(playerUuid) {
    const { getAreaData } = require('./czareaprotection');
    const areaData = getAreaData();
    const ownedAreas = [];

    if (!playerUuid || typeof playerUuid !== 'string') {
        logError("[API getAreasByOwnerUuid] 无效的 playerUuid");
        return [];
    }

    for (const areaId in areaData) {
        const area = areaData[areaId];
        // Check if the area has a uuid property and if it matches
        if (area.uuid && area.uuid === playerUuid) {
            ownedAreas.push(areaId); // 只添加区域 ID
        }
    }
    return ownedAreas;
}
