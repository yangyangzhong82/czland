// api.js - 定义供外部使用的 API 函数。
// API 导出逻辑在 apiExports.js 中处理。

const { getPlayerPermissionCached, getCustomGroupCached, groupHasPermission, getAvailableGroups } = require('./permission'); // 导入必要的函数

/**
 * 获取玩家在指定区域的权限组名称
 * @param {string} playerUuid 玩家 UUID
 * @param {string} areaId 区域 ID
 * @returns {string | null} 权限组名称，如果玩家在该区域没有特定权限组，则返回 null
 */
function getPlayerAreaGroup(playerUuid, areaId) {
    // 直接使用缓存函数获取玩家在区域的权限组
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
        return groupDetails.permissions; // 返回权限ID数组
    }
    // 如果组不存在或权限数据无效，返回 null
    return null;
}

/**
 * 获取指定区域的详细数据。
 * @param {string} areaId - 要查询的区域的ID。
 * @returns {object | null} - 返回区域的数据对象（深拷贝），如果区域不存在则返回 null。
 */
function getAreaInfo(areaId) {
    // 将 require 移到这里以避免循环依赖
    const { getAreaData } = require('./czareaprotection');
    const { logDebug } = require('./logger'); // 确保需要时 logger 可用

    const areaData = getAreaData(); // 获取所有区域数据
    if (areaData && areaData[areaId]) {
        // 返回区域数据的深拷贝，防止外部修改影响内部数据
        return JSON.parse(JSON.stringify(areaData[areaId]));
    } else {
        logDebug(`[API] 未找到区域 ID: ${areaId}`);
        return null; // 区域不存在
    }
}

// 导出函数，以便 apiExports.js 可以 require 它们

// --- 区域管理 API 函数 ---

// 注意: require('./czareaprotection') 移入了下面的函数中以避免循环依赖
const { saveAreaData } = require('./config'); // 导入保存函数
const { loadConfig } = require('./configManager'); // 导入配置加载器
const {
    // generateAreaId 在本地定义为 _generateAreaId
    checkAreaSizeLimits, // 检查区域尺寸限制
    checkNewAreaOverlap, // 检查新区域重叠
    calculatePlayerTotalAreaSize, // 计算玩家总区域大小
    calculateAreaVolume, // 计算区域体积
    isAreaWithinArea, // 检查区域是否在另一区域内
    countPlayerAreas // 计算玩家拥有的区域数量
} = require('./utils'); // 导入工具函数
const {
    calculateAreaPrice, // 计算区域价格
    handleAreaPurchase, // 处理区域购买
    getPlayerBalance, // 获取玩家余额
    reducePlayerBalance, // 减少玩家余额
    addPlayerBalance, // 增加玩家余额
    handleAreaRefund // 处理区域退款
} = require('./economy'); // 导入经济相关函数
const { checkPermission } = require('./permission'); // 导入权限检查函数
const { isAreaAdmin } = require('./areaAdmin'); // 导入管理员检查函数
const { logDebug, logInfo, logWarning, logError } = require('./logger'); // 导入日志记录器

// 如果未从 utils 导入，则使用此辅助函数生成 ID
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
    // 将 require 移到这里以避免循环依赖
    const { getAreaData, updateAreaData } = require('./czareaprotection');

    logInfo(`[API] 玩家 ${creatorPlayer.name} 尝试创建区域 "${areaName}"`);
    const config = loadConfig(); // 加载配置
    const areaData = getAreaData(); // 获取当前所有区域数据
    const economyConfig = config.economy; // 获取经济配置

    // --- 验证输入 ---
    if (!areaName || typeof areaName !== 'string' || areaName.trim() === "") {
        return { success: false, error: "区域名称不能为空" };
    }
    if (!point1 || !point2 || point1.dimid === undefined || point1.dimid !== point2.dimid) {
        return { success: false, error: "无效的坐标点或点不在同一维度" };
    }
    const isSubarea = parentAreaId !== null; // 判断是否正在创建子区域
    const parentArea = isSubarea ? areaData[parentAreaId] : null; // 如果是子区域，获取父区域数据
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
    // 创建一个临时的区域对象，用于后续的检查
    const newAreaTemp = { point1: p1, point2: p2, dimid: p1.dimid };


    // --- 限制检查 ---
    // 区域数量限制 (仅检查主区域, 管理员忽略此限制)
    if (!isSubarea && !isAreaAdmin(creatorPlayer.uuid) && config.maxAreasPerPlayer !== -1) {
        const ownedAreas = countPlayerAreas(creatorPlayer.xuid, areaData); // 计算玩家已拥有的主区域数量
        if (ownedAreas >= config.maxAreasPerPlayer) {
            return { success: false, error: `你已达到最大区域数量限制 (${config.maxAreasPerPlayer})` };
        }
    }
    // 区域尺寸限制
    const sizeCheck = checkAreaSizeLimits(p1, p2, config, isSubarea); // 检查新区域是否符合尺寸限制
    if (!sizeCheck.valid) {
        return { success: false, error: `区域大小无效: ${sizeCheck.message}` };
    }
    // 总区域大小限制 (仅检查主区域, 管理员忽略此限制)
    if (!isSubarea && !isAreaAdmin(creatorPlayer.uuid) && config.maxTotalAreaSizePerPlayer > 0) {
        const currentTotalSize = calculatePlayerTotalAreaSize(creatorPlayer.xuid, areaData); // 计算玩家当前总区域体积
        const newAreaVolume = calculateAreaVolume(newAreaTemp); // 计算新区域体积
        if (currentTotalSize + newAreaVolume > config.maxTotalAreaSizePerPlayer) {
            return { success: false, error: `创建后总区域大小将超过限制 (${currentTotalSize + newAreaVolume} > ${config.maxTotalAreaSizePerPlayer})` };
        }
    }
    // 区域重叠检查
    // 如果是子区域，检查时不考虑其父区域，因为子区域必须在父区域内
    const overlapCheck = checkNewAreaOverlap(newAreaTemp, areaData, isSubarea ? parentAreaId : null);
    if (overlapCheck.overlapped) {
        return { success: false, error: `无法创建区域：与现有区域 "${overlapCheck.overlappingArea.name}" 重叠` };
    }
    // 子区域范围检查 (必须完全在父区域内)
    if (isSubarea && parentArea) {
        if (!isAreaWithinArea(newAreaTemp, parentArea)) {
            return { success: false, error: "子区域必须完全在父区域内" };
        }
    }
    // --- 经济系统处理 ---
    let finalPrice = 0; // 最终价格
    if (!isSubarea && economyConfig.enabled) { // 子区域通常是免费的
        finalPrice = calculateAreaPrice(p1, p2); // 计算区域价格 (内部会使用加载的配置)
        const purchaseSuccess = await handleAreaPurchase(creatorPlayer, p1, p2); // 处理购买逻辑 (检查余额、扣费)
        if (!purchaseSuccess) {
            // 错误信息通常已在 handleAreaPurchase 中通过消息提示给玩家
            return { success: false, error: "经济交易失败" }; // 返回一个通用的错误信息给 API 调用者
        }
    }

    // --- 创建区域数据对象 ---
    const areaId = _generateAreaId(); // 生成唯一的区域 ID
    const newAreaData = {
        name: areaName.trim(), // 去除名称首尾空格
        point1: p1,
        point2: p2,
        dimid: p1.dimid,
        xuid: creatorPlayer.xuid, // 存储创建者的 XUID
        uuid: creatorPlayer.uuid, // 存储创建者的 UUID
        createTime: Date.now(), // 记录创建时间戳
        price: finalPrice, // 存储计算出的价格 (仅主区域有意义)
        isSubarea: isSubarea, // 标记是否为子区域
        parentAreaId: parentAreaId, // 存储父区域 ID (如果不是子区域则为 null)
        priority: isSubarea ? (parentArea.priority || 0) + 1 : 0, // 子区域优先级基于父区域，主区域默认为 0
        rules: {}, // 初始化空的规则对象
        // 如果是主区域，添加 subareas 属性用于存储子区域引用
        ...(isSubarea ? {} : { subareas: {} })
    };

    // 如果创建的是子区域，需要将其 ID 添加到父区域的 subareas 列表中
    if (isSubarea && parentArea) {
        if (!parentArea.subareas) { // 如果父区域还没有 subareas 属性，则创建它
            parentArea.subareas = {};
        }
        parentArea.subareas[areaId] = true; // 在父区域中存储子区域的引用 (值为 true 仅作标记)
    }

    // --- 保存与更新 ---
    const currentAreaData = { ...areaData }; // 创建 areaData 的可变副本，以避免直接修改缓存
    currentAreaData[areaId] = newAreaData; // 将新区域添加到副本中
    if (isSubarea && parentArea) {
        // 如果是子区域，确保父区域的 subareas 更新也被包含在要保存的数据中
        currentAreaData[parentAreaId] = parentArea;
    }


    if (saveAreaData(currentAreaData)) { // 保存更新后的完整区域数据
        logInfo(`[API] 区域 "${areaName}" (ID: ${areaId}) 由 ${creatorPlayer.name} 创建成功`);
        updateAreaData(currentAreaData); // 更新内存中的区域数据和空间索引
        // 可选: 触发一次玩家区域检查以立即更新显示? checkPlayerCallback(creatorPlayer);
        return { success: true, areaId: areaId }; // 返回成功状态和新区域 ID
    } else {
        logError(`[API] 创建区域 ${areaId} 后保存区域数据失败`);
        // 尝试回滚经济操作？这通常很复杂，取决于经济系统的实现。
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
    // 将 require 移到这里以避免循环依赖
    const { getAreaData, updateAreaData } = require('./czareaprotection');

    logInfo(`[API] 玩家 ${modifierPlayer.name} 尝试修改区域 ${areaId}，修改内容: ${JSON.stringify(modifications)}`);
    const config = loadConfig(); // 加载配置
    const areaData = getAreaData(); // 获取最新的区域数据
    const economyConfig = config.economy; // 获取经济配置
    const area = areaData[areaId]; // 获取要修改的区域对象

    if (!area) {
        return { success: false, error: "区域不存在" };
    }

    // 创建区域数据的深拷贝，用于比较或在出错时可能的回滚参考
    const originalArea = JSON.parse(JSON.stringify(area));
    let changesMade = false; // 标记是否有实际修改发生
    let errorOccurred = null; // 用于记录处理过程中的错误

    // --- 处理各项修改 ---

    // 修改名称 (Rename)
    if (modifications.name !== undefined) {
        // 权限检查: 是否有权修改名称
        if (!checkPermission(modifierPlayer, areaData, areaId, "rename")) {
            return { success: false, error: "无权限修改区域名称" };
        }
        const newName = String(modifications.name).trim(); // 获取新名称并去除首尾空格
        if (!newName) { // 检查名称是否为空
            return { success: false, error: "区域名称不能为空" };
        }
        area.name = newName; // 更新区域对象中的名称
        changesMade = true; // 标记已发生修改
        logDebug(`[API Modify ${areaId}] 名称修改为 "${newName}"`);
    }

    // 修改范围 (Resize) - 必须同时提供 point1 和 point2
    if (modifications.point1 !== undefined && modifications.point2 !== undefined) {
        // 权限检查: 是否有权调整范围
        if (!checkPermission(modifierPlayer, areaData, areaId, "resizeArea")) {
            return { success: false, error: "无权限修改区域范围" };
        }
        const p1Raw = modifications.point1; // 获取原始点1
        const p2Raw = modifications.point2; // 获取原始点2
        const dimid = area.dimid; // 假设调整范围在同一维度进行

        // 验证新坐标点是否有效
        if (!p1Raw || !p2Raw || p1Raw.x === undefined || p1Raw.y === undefined || p1Raw.z === undefined ||
            p2Raw.x === undefined || p2Raw.y === undefined || p2Raw.z === undefined) {
            return { success: false, error: "无效的新坐标点" };
        }

        // 确保坐标顺序 (p1 为最小点, p2 为最大点)
        const p1 = { x: Math.min(p1Raw.x, p2Raw.x), y: Math.min(p1Raw.y, p2Raw.y), z: Math.min(p1Raw.z, p2Raw.z), dimid: dimid };
        const p2 = { x: Math.max(p1Raw.x, p2Raw.x), y: Math.max(p1Raw.y, p2Raw.y), z: Math.max(p1Raw.z, p2Raw.z), dimid: dimid };
        const newAreaTemp = { point1: p1, point2: p2, dimid: dimid }; // 创建临时区域对象用于检查

        // 尺寸限制检查
        const sizeCheck = checkAreaSizeLimits(p1, p2, config, area.isSubarea);
        if (!sizeCheck.valid) {
            return { success: false, error: `区域大小无效: ${sizeCheck.message}` };
        }
        // 子区域范围检查 (如果调整的是子区域)
        if (area.isSubarea && area.parentAreaId) {
            const parentArea = areaData[area.parentAreaId];
            if (parentArea && !isAreaWithinArea(newAreaTemp, parentArea)) { // 检查新范围是否仍在父区域内
                return { success: false, error: "子区域必须完全在父区域内" };
            }
        }
        // 重叠检查 (需要排除自身、父区域(如果是子区域)、子区域(如果是主区域))
        const areasToCheck = {}; // 构建用于重叠检查的区域列表
        for (let id in areaData) {
            if (id === areaId) continue; // 排除自己
            if (area.isSubarea && id === area.parentAreaId) continue; // 如果是子区域，排除其父区域
            if (!area.isSubarea && area.subareas && area.subareas[id]) continue; // 如果是主区域，排除其子区域
            areasToCheck[id] = areaData[id];
        }
        const overlapCheck = checkNewAreaOverlap(newAreaTemp, areasToCheck); // 检查新范围是否与其他区域重叠
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

        // 经济系统处理 (调整范围可能涉及付费或退款)
        let priceDifference = 0; // 价格差
        let newPrice = area.price; // 如果经济系统禁用或未修改，价格保持不变
        if (!area.isSubarea && economyConfig.enabled) { // 子区域调整通常免费
            // 获取或计算原始价格 (如果 area.price 不存在，则根据原始范围计算)
            const originalPrice = area.price || calculateAreaPrice(originalArea.point1, originalArea.point2);
            newPrice = calculateAreaPrice(p1, p2); // 计算新范围的价格
            priceDifference = newPrice - originalPrice; // 计算差价

            if (priceDifference > 0) { // 新区域更大，需要额外付费
                const playerBalance = await getPlayerBalance(modifierPlayer); // 异步获取玩家余额
                if (playerBalance < priceDifference) { // 检查余额是否足够
                    return { success: false, error: `余额不足，需要额外支付 ${priceDifference}` };
                }
                if (!await reducePlayerBalance(modifierPlayer, priceDifference)) { // 异步扣款
                    return { success: false, error: "扣除额外费用失败" };
                }
                logDebug(`[API Modify ${areaId}] 因调整范围支付 ${priceDifference}`);
            } else if (priceDifference < 0) { // 新区域更小，退款
                if (!await addPlayerBalance(modifierPlayer, Math.abs(priceDifference))) { // 异步退款 (取绝对值)
                    logWarning(`[API Modify ${areaId}] 因调整范围退款 ${Math.abs(priceDifference)} 失败`);
                    // 即使退款失败，是否继续修改？目前选择继续。可以根据需求调整这里的逻辑。
                } else {
                    logDebug(`[API Modify ${areaId}] 因调整范围退款 ${Math.abs(priceDifference)}`);
                }
            }
        }

        // 应用范围和价格的修改
        area.point1 = p1;
        area.point2 = p2;
        area.price = newPrice; // 更新价格 (即使经济系统禁用，也可能更新为 0 或根据新范围计算的值)
        changesMade = true; // 标记已发生修改
        logDebug(`[API Modify ${areaId}] 范围已调整`);
    } else if (modifications.point1 !== undefined || modifications.point2 !== undefined) {
        // 如果只提供了 point1 或 point2 中的一个，则报错，因为调整范围需要两个点
        return { success: false, error: "修改区域范围必须同时提供 point1 和 point2" };
    }


    // 设置规则 (Set Rules)
    if (modifications.rules !== undefined) {
        // 权限检查: 是否有权设置规则
        if (!checkPermission(modifierPlayer, areaData, areaId, "setAreaRules")) {
            return { success: false, error: "无权限设置区域规则" };
        }
        // 验证规则数据类型是否为对象
        if (typeof modifications.rules !== 'object' || modifications.rules === null) {
            return { success: false, error: "无效的规则数据，必须是一个对象" };
        }
        area.rules = { ...modifications.rules }; // 使用扩展运算符创建新对象的副本，完全替换旧规则
        changesMade = true; // 标记已发生修改
        logDebug(`[API Modify ${areaId}] 规则已更新`);
    }

    // 转让所有者 (Transfer Owner)
    if (modifications.owner !== undefined) {
        // 权限检查: 是否有权转让区域
        if (!checkPermission(modifierPlayer, areaData, areaId, "transferArea")) {
            return { success: false, error: "无权限转让此区域" };
        }
        const newOwner = modifications.owner; // 获取新所有者信息
        // 验证新所有者数据结构是否完整
        if (!newOwner || typeof newOwner !== 'object' || !newOwner.uuid || !newOwner.xuid || !newOwner.name) {
            return { success: false, error: "无效的新主人数据，需要包含 uuid, xuid, name" };
        }
        // 检查是否尝试转让给自己
        if (newOwner.uuid === area.uuid) {
             return { success: false, error: "不能将区域转让给自己" };
        }

        // 检查接收方的总大小限制 (仅主区域, 管理员忽略)
        if (!area.isSubarea && !isAreaAdmin(newOwner.uuid) && config.maxTotalAreaSizePerPlayer > 0) {
            const receiverCurrentTotalSize = calculatePlayerTotalAreaSize(newOwner.xuid, areaData); // 计算接收方当前总大小
            const areaToTransferSize = calculateAreaVolume(area); // 计算要转让的区域大小
            if (receiverCurrentTotalSize + areaToTransferSize > config.maxTotalAreaSizePerPlayer) { // 检查是否超限
                return { success: false, error: `无法转让：接收方 ${newOwner.name} 的总区域大小将超过其限制` };
            }
        }

        // 更新所有者信息
        area.uuid = newOwner.uuid;
        area.xuid = newOwner.xuid;
        area.playerName = newOwner.name; // 可选地存储玩家名称，方便显示
        changesMade = true; // 标记已发生修改
        logDebug(`[API Modify ${areaId}] 所有者已转让给 ${newOwner.name} (${newOwner.uuid})`);
    }

    // 设置优先级 (Set Priority) - 这是一个示例性修改
    if (modifications.priority !== undefined) {
        // 可选：添加权限检查，例如只有管理员或特定角色能修改优先级
        // if (!checkPermission(modifierPlayer, areaData, areaId, "setPriority")) ...
        const newPriority = parseInt(modifications.priority, 10); // 将输入转换为整数
        if (isNaN(newPriority)) { // 检查是否为有效数字
            return { success: false, error: "无效的优先级数值" };
        }
        // 注意：简单地设置优先级可能不足够，如果需要严格的优先级排序，
        // 可能需要更复杂的逻辑来重新计算和调整同级区域（例如同一父区域下的子区域）的优先级。
        area.priority = newPriority; // 更新优先级
        changesMade = true; // 标记已发生修改
        logDebug(`[API Modify ${areaId}] 优先级设置为 ${newPriority}`);
    }


    // --- 保存与更新 ---
    if (changesMade) { // 只有在实际发生修改时才需要保存
        const currentAreaData = { ...areaData }; // 创建 areaData 的可变副本
        currentAreaData[areaId] = area; // 将修改后的区域对象放回副本中

        if (saveAreaData(currentAreaData)) { // 保存整个更新后的 areaData 对象
            logInfo(`[API] 区域 ${areaId} 由 ${modifierPlayer.name} 修改成功`);
            updateAreaData(currentAreaData); // 更新内存中的数据和空间索引
            return { success: true }; // 返回成功状态
        } else {
            logError(`[API] 修改区域 ${areaId} 后保存区域数据失败`);
            // 尝试回滚修改？这通常很困难，取决于修改的复杂性。
            // 目前仅报告保存失败。
            return { success: false, error: "区域修改成功但保存失败，请检查日志" };
        }
    } else {
        logInfo(`[API] 未对区域 ${areaId} 应用任何修改 (没有提供有效修改或无需修改)`);
        return { success: true }; // 如果没有请求或需要进行的修改，也视为成功
    }
}


/**
 * [内部] 根据提供的数据创建一个新区域，用于数据迁移,专门用于iland迁移等场景。
 * 跳过玩家对象相关的检查（权限、经济、玩家限制）。主要用于数据迁移场景。
 * @param {string} ownerXuid 区域所有者的 XUID。
 * @param {string | null} ownerUuid 区域所有者的 UUID (如果可用，否则为 null)。
 * @param {string} areaName 新区域的名称。
 * @param {object} point1 第一个角点坐标 {x, y, z}。
 * @param {object} point2 第二个角点坐标 {x, y, z}。
 * @param {number} dimid 区域所在的维度 ID。
 * @param {object | null} teleportData 可选的传送点数据 {x, y, z} (来自旧数据)。
 * @returns {{success: boolean, areaId?: string, error?: string, message?: string}} 操作结果，可能包含 areaId 或错误信息，或提示信息（如区域已存在）。
 */
function _internal_createAreaFromData(ownerXuid, ownerUuid, areaName, point1, point2, dimid, teleportData = null) {
    // 将 require 移到这里以避免循环依赖
    const { getAreaData, updateAreaData } = require('./czareaprotection');

    logInfo(`[API Internal] 尝试通过数据迁移创建区域 "${areaName}" (所有者 XUID: ${ownerXuid})`);
    const config = loadConfig(); // 加载配置
    const areaData = getAreaData(); // 获取当前所有区域数据

    // --- 验证输入 ---
    if (!areaName || typeof areaName !== 'string' || areaName.trim() === "") {
        areaName = `区域_${ownerXuid}_${Date.now()}`; // 如果名称无效，提供一个默认名称
        logWarning(`[API Internal] 区域名称无效，使用默认名称: ${areaName}`);
    }
     if (!ownerXuid) { // 必须有所有者 XUID
        return { success: false, error: "所有者 XUID 不能为空" };
    }
    if (!point1 || !point2 || dimid === undefined || dimid === null) { // 必须有有效的点和维度
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
    const newAreaTemp = { point1: p1, point2: p2, dimid: p1.dimid }; // 创建临时区域对象用于检查

    // --- 限制检查 (简化版，主要检查重叠) ---
    // 区域尺寸限制 (在数据迁移时通常跳过此检查)
    /*
    const sizeCheck = checkAreaSizeLimits(p1, p2, config, false); // 假设迁移的是主区域
    if (!sizeCheck.valid) {
        logError(`[API Internal] 区域 "${areaName}" (所有者: ${ownerXuid}) 尺寸无效: ${sizeCheck.message}，但迁移时将忽略此限制。`);
        // return { success: false, error: `区域大小无效: ${sizeCheck.message}` }; // 注释掉以忽略限制
    }
    */
    // 区域重叠检查 (这个检查仍然很重要)
    const overlapCheck = checkNewAreaOverlap(newAreaTemp, areaData, null); // 检查是否与任何现有区域重叠
    if (overlapCheck.overlapped) {
        // 如果发生重叠，进一步检查重叠的区域是否与当前尝试创建的数据完全一致
        // 这有助于处理重复运行迁移脚本的情况
        const existing = overlapCheck.overlappingArea; // 获取重叠的现有区域数据
        if (existing.xuid === ownerXuid && // 检查所有者 XUID 是否匹配
            existing.name === areaName.trim() && // 检查名称是否匹配
            existing.point1.x === p1.x && existing.point1.y === p1.y && existing.point1.z === p1.z && // 检查点1坐标是否匹配
            existing.point2.x === p2.x && existing.point2.y === p2.y && existing.point2.z === p2.z && // 检查点2坐标是否匹配
            existing.dimid === p1.dimid) { // 检查维度是否匹配
            // 如果所有关键数据都匹配，则认为这是同一个区域，可能是重复迁移
            logWarning(`[API Internal] 区域 "${areaName}" (ID: ${overlapCheck.overlappingAreaId}) 已存在且数据匹配，跳过重复创建。`);
            // 返回成功，并附带消息说明区域已存在
            return { success: true, areaId: overlapCheck.overlappingAreaId, message: "区域已存在，跳过创建" };
        } else {
            // 如果重叠但数据不完全匹配，则报告错误
            logError(`[API Internal] 无法创建区域 "${areaName}"：与现有区域 "${existing.name}" (ID: ${overlapCheck.overlappingAreaId}) 重叠，且数据不完全匹配。`);
            return { success: false, error: `无法创建区域：与现有区域 "${existing.name}" 重叠` };
        }
    }

    // --- 处理可能的 2D 区域 Y 坐标 ---
    // 在某些旧的领地插件中，2D 区域可能使用特定的 Y 值范围（如 -64 到 320）来表示全高度。
    // 这里尝试检测这种情况并将其标准化为本插件使用的 Y 范围（如果需要）。
    // 注意：这里的 minY 和 maxY 应与本插件配置或默认的全高度 Y 值匹配。
    const minY = config.worldMinY !== undefined ? config.worldMinY : -64; // 从配置获取或使用默认值
    const maxY = config.worldMaxY !== undefined ? config.worldMaxY : 320; // 从配置获取或使用默认值
    let finalP1 = { ...p1 }; // 创建坐标副本以进行修改
    let finalP2 = { ...p2 };

    // 检查 Y 坐标是否匹配预设的 2D 范围
    if ((p1.y === minY && p2.y === maxY) || (p1.y === maxY && p2.y === minY)) {
        logDebug(`[API Internal] 检测到可能的 2D 区域 (Y 范围 ${minY}-${maxY})，将强制设置为全高度。`);
        // 确保 Y 坐标是正确的最小值和最大值
        finalP1.y = minY;
        finalP2.y = maxY;
    } else {
        // 如果不是预设的 2D 范围，则按 3D 区域处理
        logDebug(`[API Internal] 处理为 3D 区域，Y 范围: ${p1.y} - ${p2.y}`);
    }


    // --- 创建区域数据对象 ---
    const areaId = _generateAreaId(); // 生成新的唯一区域 ID
    const newAreaData = {
        name: areaName.trim(), // 去除名称首尾空格
        point1: finalP1, // 使用可能调整过 Y 坐标的点1
        point2: finalP2, // 使用可能调整过 Y 坐标的点2
        dimid: finalP1.dimid, // 维度 ID
        xuid: ownerXuid, // 所有者 XUID
        uuid: ownerUuid || null, // 所有者 UUID (如果提供了)
        createTime: Date.now(), // 记录创建时间戳
        price: 0, // 迁移的区域价格通常设为 0
        isSubarea: false, // 假设迁移的是主区域
        parentAreaId: null, // 主区域没有父 ID
        priority: 0, // 默认优先级为 0
        rules: {}, // 初始化空的规则对象
        subareas: {} // 主区域需要 subareas 属性来存储子区域引用
    };

    // 处理从旧数据迁移过来的传送点信息
    if (teleportData && Array.isArray(teleportData) && teleportData.length === 3) {
        // 假设 teleportData 是 [x, y, z] 数组
        newAreaData.teleportPoint = {
            x: teleportData[0],
            y: teleportData[1],
            z: teleportData[2],
            dimid: finalP1.dimid, // 传送点维度与区域维度一致
            yaw: 0,         // 设置默认 Yaw (朝向)
            pitch: 0        // 设置默认 Pitch (俯仰角)
        };
        logDebug(`[API Internal] 为区域 ${areaId} 设置了迁移的传送点: ${JSON.stringify(newAreaData.teleportPoint)}`);
    }


    // --- 保存与更新 ---
    const currentAreaData = { ...areaData }; // 创建 areaData 的可变副本
    currentAreaData[areaId] = newAreaData; // 将新创建的区域添加到副本中

    if (saveAreaData(currentAreaData)) { // 保存更新后的完整区域数据
        logInfo(`[API Internal] 区域 "${areaName}" (ID: ${areaId}) 通过数据迁移创建成功`);
        updateAreaData(currentAreaData); // 更新内存中的区域数据和空间索引
        return { success: true, areaId: areaId }; // 返回成功状态和新区域 ID
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
 * @returns {boolean} 如果组存在且包含该权限，则返回 true，否则返回 false。如果标识符无效或组不存在也返回 false。
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

    // 直接调用 permission.js 中的核心逻辑来检查组是否拥有权限
    return groupHasPermission(creatorUuid, groupName, permissionId);
}

/**
 * 获取所有可用的自定义权限组的唯一标识符列表。
 * @returns {string[]} 包含所有可用自定义权限组唯一标识符的数组，格式: ["组名1_创建者UUID1", "组名2_创建者UUID2", ...]
 */
function getAvailablePermissionGroups() {
    // 直接调用 permission.js 中的函数获取列表
    return getAvailableGroups();
}


module.exports = {
    getPlayerAreaGroup, // 获取玩家在区域的权限组
    getGroupPermissions, // 获取组的权限列表
    getAvailablePermissionGroups, // 获取所有可用组的列表
    checkGroupPermission, // 检查组是否拥有特定权限
    _internal_createAreaFromData, // [内部] 从数据创建区域 (用于迁移)
    createArea, // 创建新区域
    modifyArea, // 修改现有区域
    getAreaInfo, // 获取区域详细信息
    deleteArea, // 删除区域
    getAreasByOwner, // 根据 XUID 获取玩家拥有的区域列表
    getAreaAtPosition, // 获取指定位置的最高优先级区域
    getAllAreaIds, // 获取所有区域的 ID 列表
    checkAreaPermission, // 检查玩家在区域的权限 (包装器)
    getAreasByOwnerUuid // 根据 UUID 获取玩家拥有的区域列表
};



/**
 * 删除一个区域。
 * @param {Player | string} deleter - 执行删除操作的玩家对象或其 UUID。
 * @param {string} areaId - 要删除的区域的 ID。
 * @param {boolean} [force=false] - 是否强制删除 (例如，即使包含子区域也删除，需要特殊权限)。
 * @returns {Promise<{success: boolean, refundedAmount?: number, error?: string}>} - 操作结果，成功时可能包含退款金额。
 */
async function deleteArea(deleter, areaId, force = false) {
    // 导入所需模块 (在函数内部以避免循环依赖)
    const { getAreaData, updateAreaData } = require('./czareaprotection');
    const { checkPermission } = require('./permission');
    const { handleAreaRefund } = require('./economy');
    const { saveAreaData } = require('./config');
    const { loadConfig } = require('./configManager');
    const { logInfo, logWarning, logError, logDebug } = require('./logger'); // 确保 logDebug 可用
    const { isAreaAdmin } = require('./areaAdmin');

    const config = loadConfig(); // 加载配置
    const areaData = getAreaData(); // 获取当前区域数据
    const area = areaData[areaId]; // 获取要删除的区域对象

    if (!area) { // 检查区域是否存在
        return { success: false, error: "区域不存在" };
    }

    // --- 权限检查 ---
    let deleterPlayer = null; // 完整的玩家对象 (如果提供)
    let deleterUuid = null; // 删除者的 UUID
    // 判断 deleter 参数是玩家对象还是 UUID 字符串
    if (typeof deleter === 'object' && deleter && deleter.uuid) {
        deleterPlayer = deleter;
        deleterUuid = deleter.uuid;
    } else if (typeof deleter === 'string') {
        deleterUuid = deleter; // 假设传入的是 UUID
    } else {
        // 如果 deleter 既不是有效对象也不是字符串，则无法进行权限检查
        return { success: false, error: "无效的删除者信息 (需要 Player 对象或 UUID)" };
    }

    // 检查删除权限
    const hasPermission = checkPermission(deleterPlayer || deleterUuid, areaData, areaId, "delete");
    if (!hasPermission) {
        return { success: false, error: "无权限删除此区域" };
    }

    logInfo(`[API] ${deleterPlayer ? deleterPlayer.name : `用户(${deleterUuid})`} 尝试删除区域 ${areaId}`);

    // --- 子区域检查 ---
    // 如果是主区域，且包含子区域，并且没有使用强制删除选项
    if (!area.isSubarea && area.subareas && Object.keys(area.subareas).length > 0 && !force) {
        return { success: false, error: "无法删除：该区域包含子区域。请先删除子区域或使用强制删除选项。" };
    }
    // 强制删除需要管理员权限
    if (force && !isAreaAdmin(deleterUuid)) {
         return { success: false, error: "无权限强制删除包含子区域的区域" };
    }

    // --- 经济退款 (仅对主区域进行退款处理) ---
    let refundedAmount = 0; // 初始化退款金额
    // 检查是否为主区域、经济系统是否启用、是否配置了删除时退款
    if (!area.isSubarea && config.economy.enabled && config.economy.refundOnDelete) {
        // handleAreaRefund 函数内部会根据 area 对象中的所有者信息进行退款。
        // deleterPlayer 参数主要用于向执行删除操作的玩家发送消息。
        // 即使 deleterPlayer 为 null (只提供了 UUID)，退款逻辑本身应该仍然可以执行。
        try {
            // 调用退款处理函数，传递玩家对象（可能为 null）和区域对象
            refundedAmount = await handleAreaRefund(deleterPlayer, area);
            // 记录退款尝试结果
            logInfo(`[API] 区域 ${areaId} 删除，尝试退款 ${refundedAmount} (基于区域主人信息)`);
        } catch (refundError) {
            logError(`[API] 区域 ${areaId} 删除时调用退款处理失败: ${refundError.message}`);
            // 根据策略决定是否因退款失败而停止删除。目前选择继续删除。
        }
    }

    // --- 执行删除 ---
    const currentAreaData = { ...areaData }; // 创建区域数据的可变副本

    // 如果删除的是子区域，需要从其父区域的 subareas 列表中移除引用
    if (area.isSubarea && area.parentAreaId && currentAreaData[area.parentAreaId]) {
        const parentArea = currentAreaData[area.parentAreaId]; // 获取父区域对象
        if (parentArea.subareas && parentArea.subareas[areaId]) { // 检查父区域是否有 subareas 且包含此子区域
            delete parentArea.subareas[areaId]; // 删除引用
            logDebug(`[API] 从父区域 ${area.parentAreaId} 的 subareas 中移除 ${areaId}`);
        }
    }

    // 如果是强制删除主区域且该区域包含子区域
    if (force && !area.isSubarea && area.subareas && Object.keys(area.subareas).length > 0) {
        logWarning(`[API] 强制删除区域 ${areaId}，其子区域 (${Object.keys(area.subareas).join(', ')}) 将成为孤立区域，除非手动处理或实现级联删除。`);
        // 注意：当前的实现只是记录警告。
        // 一个更完善的实现可能会在这里递归调用 deleteArea 来删除所有子区域，
        // 或者直接从 currentAreaData 中删除这些子区域的数据。
        // 例如 (直接删除子区域数据):
        // for (const subId in area.subareas) {
        //     if (currentAreaData[subId]) {
        //         delete currentAreaData[subId]; // 从副本中删除子区域数据
        //         logInfo(`[API] 强制删除，子区域 ${subId} 已被移除。`);
        //     }
        // }
    }

    // 从区域数据副本中删除该区域本身
    delete currentAreaData[areaId];

    // --- 保存与更新 ---
    if (saveAreaData(currentAreaData)) { // 保存更新后的完整区域数据
        logInfo(`[API] 区域 ${areaId} 已成功删除`);
        updateAreaData(currentAreaData); // 更新内存中的数据和空间索引
        return { success: true, refundedAmount: refundedAmount }; // 返回成功状态和退款金额
    } else {
        logError(`[API] 删除区域 ${areaId} 后保存区域数据失败`);
        // 尝试回滚？这通常非常困难，特别是如果已经发生了经济操作。
        // 目前仅报告保存失败。
        return { success: false, error: "区域删除成功但保存失败，请检查日志" };
    }
}

/**
 * 获取指定玩家拥有的所有区域 ID 列表。
 * @param {string} playerXuid - 玩家的 XUID。
 * @returns {string[]} - 该玩家拥有的所有区域的 ID 数组。
 */
function getAreasByOwner(playerXuid) {
    const { getAreaData } = require('./czareaprotection'); // 获取区域数据访问函数
    const areaData = getAreaData(); // 获取所有区域数据
    const ownedAreas = []; // 初始化结果数组

    // 遍历所有区域
    for (const areaId in areaData) {
        const area = areaData[areaId];
        // 检查区域的 xuid 是否与目标玩家匹配
        if (area.xuid === playerXuid) {
            ownedAreas.push(areaId); // 如果匹配，将区域 ID 添加到结果数组
        }
    }
    return ownedAreas; // 返回包含所有匹配区域 ID 的数组
}

/**
 * 获取指定坐标点处优先级最高的区域信息。
 * @param {object} position - 坐标对象 {x, y, z, dimid}。
 * @returns {object | null} - 返回该位置优先级最高的区域的数据对象（深拷贝），如果该位置不在任何区域内，则返回 null。
 */
function getAreaAtPosition(position) {
    // 导入所需模块
    const { getAreaData, getSpatialIndex } = require('./czareaprotection');
    const { getPriorityAreasAtPosition } = require('./utils'); // 导入实际执行查询的核心函数
    const { logError } = require('./logger'); // 确保 logger 可用

    // 验证输入的位置对象是否有效
    if (!position || position.x === undefined || position.y === undefined || position.z === undefined || position.dimid === undefined) {
        logError("[API getAreaAtPosition] 无效的位置对象");
        return null;
    }

    const areaData = getAreaData(); // 获取所有区域数据
    const spatialIndex = getSpatialIndex(); // 获取空间索引

    // 调用核心函数获取该位置的所有区域，并按优先级排序
    const areasAtPos = getPriorityAreasAtPosition(position, areaData, spatialIndex);

    if (areasAtPos.length > 0) {
        // 如果找到了区域，areasAtPos[0] 是优先级最高的区域
        // getPriorityAreasAtPosition 返回的是包含 {id, area, depth, parentAreaId} 的对象数组
        // 我们需要返回 area 字段，即区域的完整数据
        // 使用深拷贝确保返回的数据与内部缓存隔离
        return JSON.parse(JSON.stringify(areasAtPos[0].area));
    } else {
        return null; // 如果数组为空，说明该位置不在任何已知区域内
    }
}

/**
 * 获取所有区域的 ID 列表。
 * @returns {string[]} - 包含服务器上所有已定义区域的 ID 的数组。
 */
function getAllAreaIds() {
    const { getAreaData } = require('./czareaprotection'); // 获取区域数据访问函数
    const areaData = getAreaData(); // 获取所有区域数据对象
    // Object.keys() 返回一个包含对象自身所有可枚举属性名称的字符串数组
    return Object.keys(areaData); // areaData 的键就是区域 ID
}

/**
 * 检查玩家在指定区域是否拥有特定权限 (API 包装器)。
 * @param {Player | string} player - 玩家对象或其 UUID。
 * @param {string} areaId - 要检查的区域 ID。
 * @param {Player | string} player - 玩家对象或其 UUID。
 * @param {string} areaId - 要检查权限的区域 ID。如果为 null 或 undefined，则检查全局权限。
 * @param {string} permissionId - 要检查的权限 ID (例如 "break", "interact", "manageMembers")。
 * @returns {boolean} - 如果玩家拥有该权限，则返回 true，否则返回 false。
 */
function checkAreaPermission(player, areaId, permissionId) {
    // 导入所需模块
    const { getAreaData } = require('./czareaprotection');
    const { checkPermission } = require('./permission'); // 导入核心权限检查函数
    const areaData = getAreaData(); // 获取所有区域数据

    // 直接调用核心权限检查函数，它会处理玩家对象/UUID、区域ID（或全局）以及权限ID
    return checkPermission(player, areaData, areaId, permissionId);
}

/**
 * 获取指定玩家 UUID 拥有的所有区域 ID 列表。
 * @param {string} playerUuid - 玩家的 UUID。
 * @returns {string[]} - 该玩家拥有的所有区域的 ID 数组。
 */
function getAreasByOwnerUuid(playerUuid) {
    const { getAreaData } = require('./czareaprotection'); // 获取区域数据访问函数
    const { logError } = require('./logger'); // 导入日志记录器
    const areaData = getAreaData(); // 获取所有区域数据
    const ownedAreas = []; // 初始化结果数组

    // 验证输入的 UUID 是否有效
    if (!playerUuid || typeof playerUuid !== 'string') {
        logError("[API getAreasByOwnerUuid] 无效的 playerUuid");
        return []; // 返回空数组
    }

    // 遍历所有区域
    for (const areaId in areaData) {
        const area = areaData[areaId];
        // 检查区域对象是否有 uuid 属性，并且该属性是否与目标玩家 UUID 匹配
        if (area.uuid && area.uuid === playerUuid) {
            ownedAreas.push(areaId); // 如果匹配，将区域 ID 添加到结果数组
        }
    }
    return ownedAreas; // 返回包含所有匹配区域 ID 的数组
}
