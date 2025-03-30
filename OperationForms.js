const { loadAreaData, saveAreaData } = require('./config');
const { getAreaData, updateAreaData } = require('./czareaprotection'); // Added updateAreaData
// Import necessary functions from utils, including checkOverlapWithRestrictedZones
const { isInArea, isAreaWithinArea, checkNewAreaOverlap, checkAreaSizeLimits, getAreaDepth, calculateAreaVolume, checkPlayerAreaLimits, calculatePlayerAreaStats, checkOverlapWithRestrictedZones } = require('./utils');
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
const { getPlayerCustomGroups, createCustomGroup, editCustomGroup, deleteCustomGroup, getAllCustomGroups } = require('./customGroups'); // Ensure getAllCustomGroups is imported if needed elsewhere, though getAvailableGroups uses it internally
const { checkPermission, setPlayerPermission, getPlayerPermission, getAvailableGroups, getAreaDefaultGroup, setAreaDefaultGroup, resetCache } = require('./permission'); // Removed DEFAULT_GROUPS import, Added resetCache
const { getPlayerData } = require('./playerDataManager');
const { isAreaAdmin } = require('./areaAdmin'); // Import isAreaAdmin
const { calculateAreaPrice, handleAreaPurchase, handleAreaRefund, getPlayerBalance, reducePlayerBalance, addPlayerBalance } = require('./economy'); // Added economy functions
// LiteLoader-AIDS automatic generated
/// <reference path="d:\mc\插件/dts/HelperLib-master/src/index.d.ts"/>
const { loadConfig } = require('./configManager');
const { showSubAreaManageForm } = require('./subareaForms');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
// Import mainForm functions carefully to avoid circular dependency issues if possible
// It's often safer to require them inside the function if needed, but let's try top-level first.
// If errors occur, move these requires into the functions that need them.
const { showAreaOperateForm, showAreaListForm, showMainForm } = require('./mainForm');

// 添加 origin 参数
function confirmResizeArea(player, areaId, origin) {
    const playerData = getPlayerData();
    const areaData = getAreaData();
    if(!checkPermission(player, areaData, areaId, "resizeArea")) {
        player.tell("§c你没有权限修改区域范围！");
        showAreaOperateForm(player, areaId, origin); // 返回时传递 origin
        return;
    }
    if(!playerData[player.uuid] || !playerData[player.uuid].pos1 || !playerData[player.uuid].pos2) {
        player.tell("§c请先用选区工具设置两个新的边界点！");
        showAreaOperateForm(player, areaId, origin); // 返回时传递 origin
        return;
    }

    const point1 = playerData[player.uuid].pos1;
    const point2 = playerData[player.uuid].pos2;

    if(point1.dimid !== point2.dimid) {
        player.tell("§c两个点必须在同一维度！");
        showAreaOperateForm(player, areaId, origin); // 返回时传递 origin
        return;
    }

    // 获取区域数据
    const area = areaData[areaId];

    if(!area) {
        player.tell("§c无法找到该区域！");
        showAreaOperateForm(player, areaId, origin); // 返回时传递 origin
        return;
    }

    // 创建新区域临时对象用于检查重叠
    const newAreaTemp = {
        point1: {
            x: Math.min(point1.x, point2.x), // Ensure correct order for checks
            y: Math.min(point1.y, point2.y),
            z: Math.min(point1.z, point2.z)
        },
        point2: {
            x: Math.max(point1.x, point2.x),
            y: Math.max(point1.y, point2.y),
            z: Math.max(point1.z, point2.z)
        },
        dimid: point1.dimid
    };
    // 检查子区域逻辑
    if(area.isSubarea && area.parentAreaId) {
        const parentArea = areaData[area.parentAreaId];
        if(parentArea) {
            // 确保子区域仍在父区域内
            const parentAreaObj = {
                point1: parentArea.point1,
                point2: parentArea.point2,
                dimid: parentArea.dimid
            };

            if(!isAreaWithinArea(newAreaTemp, parentAreaObj)) {
                player.tell("§c子区域必须完全在父区域内！");
                showAreaOperateForm(player, areaId, origin); // 返回时传递 origin
                return;
            }
        }
    }

    // 获取其他区域数据（排除当前区域）
    const areasToCheck = {};
    for(let id in areaData) {
        // 排除自己
        if(id === areaId) continue;

        // 如果是子区域，排除父区域
        if(area.isSubarea && id === area.parentAreaId) continue;

        // 如果是父区域，排除自己的子区域
        if(!area.isSubarea && area.subareas && area.subareas[id]) continue;

        areasToCheck[id] = areaData[id];
    }

    // 检查与其他区域是否重叠
    const overlapCheck = checkNewAreaOverlap(newAreaTemp, areasToCheck);
    if(overlapCheck.overlapped) {
        player.tell(`§c无法调整区域范围：与现有区域 "${overlapCheck.overlappingArea.name}" 重叠！`);
        showAreaOperateForm(player, areaId, origin); // 返回时传递 origin
        return;
    }

    // --- 新增：检查新范围是否与禁止区域重叠 ---
    const config = loadConfig(); // 加载配置以获取 restrictedZones
    const restrictedZoneCheck = checkOverlapWithRestrictedZones(
        newAreaTemp, // 使用上面创建的临时新区域对象
        config.restrictedZones || []
    );
    if (restrictedZoneCheck.overlapped) {
        player.tell(`§c无法调整区域范围：新范围与禁止区域 "${restrictedZoneCheck.overlappingZone.name || '未命名'}" 重叠！`);
        showAreaOperateForm(player, areaId, origin); // 返回
        return;
    }
    // --- 禁止区域检查结束 ---

    // --- 检查单个区域尺寸限制 (包含深度) ---
    // const config = loadConfig(); // 已在前面加载
    const areaDepth = getAreaDepth(areaId, areaData); // 计算区域深度
    const sizeCheck = checkAreaSizeLimits(point1, point2, config, area.isSubarea, areaDepth); // 传入深度

    if (!sizeCheck.valid) {
        player.tell(`§c无法调整区域范围: ${sizeCheck.message}`);
        showAreaOperateForm(player, areaId, origin); // 返回时传递 origin
        return;
    }
    // --- 单个区域尺寸检查结束 ---

    // --- 检查玩家总体积限制 (如果玩家是所有者且非管理员) ---
    if (!isAreaAdmin(player.uuid) && area.xuid === player.xuid) {
        const oldVolume = calculateAreaVolume(area.point1, area.point2);
        const newVolume = calculateAreaVolume(point1, point2);
        const volumeDifference = newVolume - oldVolume;

        // 如果体积增加了，才需要检查是否超出限制
        if (volumeDifference > 0) {
            const limitsConfig = config.playerAreaLimits;
            if (limitsConfig && limitsConfig.enabled) {
                const playerStats = calculatePlayerAreaStats(player.xuid, areaData);

                let limitKey;
                if (areaDepth === 0) limitKey = 'main';
                else if (areaDepth === 1) limitKey = 'subarea';
                else if (areaDepth === 2) limitKey = 'subareaLevel2';
                else limitKey = 'subareaLevel3';

                const limits = limitsConfig[limitKey];
                const currentStats = playerStats[limitKey];

                if (limits && limits.maxTotalVolume !== -1 && (currentStats.totalVolume + volumeDifference) > limits.maxTotalVolume) {
                    player.tell(`§c无法调整区域范围: 新的总体积 (${currentStats.totalVolume + volumeDifference}) 将超过你的 ${limitKey} 类区域总体积上限 (${limits.maxTotalVolume})`);
                    showAreaOperateForm(player, areaId, origin); // 返回
                    return;
                }
            }
        }
    }
    // --- 玩家总体积检查结束 ---


    let originalPrice = 0;
    let newPrice = 0;
    let priceDifference = 0;
    let priceText = "";
    const economyConfig = config.economy; // Cache config

    if(economyConfig && economyConfig.enabled) {
        // 计算原区域的价格
        originalPrice = area.price || calculateAreaPrice(area.point1, area.point2, economyConfig); // Pass config

        // 计算新区域的价格
        newPrice = calculateAreaPrice(point1, point2, economyConfig); // Pass config

        // 计算价格差异
        priceDifference = newPrice - originalPrice;

        const currencyName = economyConfig.type === "scoreboard" ? "点" : "金币";

        if(priceDifference > 0) {
            // 新区域更大，需要额外付费
            priceText = `§e新区域比原区域更大，需要额外支付 ${priceDifference} ${currencyName}`;
        } else if(priceDifference < 0) {
            // 新区域更小，可以获得退款
            priceText = `§e新区域比原区域更小，你将获得 ${Math.abs(priceDifference)} ${currencyName}退款`;
        } else {
            priceText = "§e区域价格没有变化";
        }
    }

    const fm = mc.newCustomForm();
    fm.setTitle("确认修改区域范围");
    fm.addLabel(`新的区域范围将为：\n从(${point1.x}, ${point1.y}, ${point1.z})\n到(${point2.x}, ${point2.y}, ${point2.z})`); // index 0
    fm.addLabel(`所在维度：${point1.dimid}`); // index 1

    let confirmIndex = 2; // Default index for confirm switch

    // 如果经济系统启用，显示价格变化信息
    if(economyConfig && economyConfig.enabled) {
        fm.addLabel(priceText); // index 2
        confirmIndex = 3; // Adjust index if price label is added
    }

    fm.addSwitch("确认修改", false); // index confirmIndex
    const backSwitchIndex = confirmIndex + 1; // 返回开关索引
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showAreaOperateForm(player, areaId, origin); // 取消返回
            return;
        }
        // 检查返回开关
        if(data[backSwitchIndex]) {
            showAreaOperateForm(player, areaId, origin);
            return;
        }

        if(!data[confirmIndex]) {
            // 用户未确认修改
            player.tell("§e修改已取消。");
            showAreaOperateForm(player, areaId, origin);
            return;
        }

        // 检查经济系统
        if(economyConfig && economyConfig.enabled && priceDifference > 0) {
            // 如果新区域更大，需要额外付费
            const playerBalance = getPlayerBalance(player, economyConfig);
            const currencyName = economyConfig.type === "scoreboard" ? "点" : "金币";

            if(playerBalance < priceDifference) {
                player.tell(`§c你的余额不足！需要额外支付 ${priceDifference} ${currencyName}，当前余额 ${playerBalance} ${currencyName}`);
                showAreaOperateForm(player, areaId, origin); // 返回操作菜单
                return;
            }

            // 扣除额外费用
            if(!reducePlayerBalance(player, priceDifference, economyConfig)) {
                player.tell("§c扣款失败，请联系管理员");
                showAreaOperateForm(player, areaId, origin); // 返回操作菜单
                return;
            }

            player.tell(`§a成功支付额外费用 ${priceDifference} ${currencyName}`);
        }

        // 重新获取区域数据以确保使用最新数据
        const updatedAreaData = getAreaData();
        const currentArea = updatedAreaData[areaId];

        // 保存新的区域范围 (确保点1是最小值，点2是最大值)
        currentArea.point1 = {
            x: Math.min(point1.x, point2.x),
            y: Math.min(point1.y, point2.y),
            z: Math.min(point1.z, point2.z)
        };
        currentArea.point2 = {
            x: Math.max(point1.x, point2.x),
            y: Math.max(point1.y, point2.y),
            z: Math.max(point1.z, point2.z)
        };
        currentArea.dimid = point1.dimid;

        // 更新区域价格
        if(economyConfig && economyConfig.enabled) {
            currentArea.price = newPrice;

            // 如果新区域更小，提供退款
            if(priceDifference < 0) {
                const currencyName = economyConfig.type === "scoreboard" ? "点" : "金币";

                if(addPlayerBalance(player, Math.abs(priceDifference), economyConfig)) {
                    player.tell(`§a已退还 ${Math.abs(priceDifference)} ${currencyName}`);
                } else {
                    player.tell("§c退款失败，请联系管理员");
                }
            }
        }

        if(saveAreaData(updatedAreaData)) {
            player.tell("§a区域范围已成功更新！");
            updateAreaData(updatedAreaData); // 更新内存中的数据
            // 清除临时数据
            const pData = getPlayerData(); // 获取最新的玩家数据
            if (pData[player.uuid]) {
                 delete pData[player.uuid].pos1;
                 delete pData[player.uuid].pos2;
                 // 注意：直接修改 getPlayerData 返回的对象可能不是最佳实践，取决于其实现
                 // 如果 getPlayerData 返回的是副本，需要一个保存函数
            }
        } else {
            player.tell("§c更新区域范围失败！");
        }

        showAreaOperateForm(player, areaId, origin); // 返回操作菜单
    });
}

// 添加 origin 参数
function showRenameForm(player, areaId, origin) {
    const areaData = getAreaData();
    const area = areaData[areaId];

    // 检查权限
    if(!checkPermission(player, areaData, areaId, "rename")) {
        player.tell("§c你没有权限修改区域名称！");
        showAreaOperateForm(player, areaId, origin); // 返回
        return;
    }

    const fm = mc.newCustomForm();
    fm.setTitle(`修改区域名称 - ${area.name}`);
    fm.addInput("新名称", "请输入新的区域名称", area.name); // index 0
    const backSwitchIndex = 1; // 返回开关索引
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showAreaOperateForm(player, areaId, origin); // 取消返回
            return;
        }
        // 检查返回开关
        if(data[backSwitchIndex]) {
            showAreaOperateForm(player, areaId, origin);
            return;
        }

        const newName = data[0].trim();
        if(!newName) {
            player.tell("§c区域名称不能为空！");
            showRenameForm(player, areaId, origin); // 重新显示改名表单
            return;
        }

        // 保存新名称
        area.name = newName;
        if(saveAreaData(areaData)) {
            player.tell("§a区域名称修改成功！");
            updateAreaData(areaData); // 更新内存
        } else {
            player.tell("§c区域名称修改失败！");
        }

        showAreaOperateForm(player, areaId, origin); // 操作完成后返回
    });
}

// 添加 origin 参数
function confirmDeleteArea(player, areaId, origin) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    const config = loadConfig().economy;

    if (!area) {
        player.tell("§c区域不存在！");
        // 根据 origin 返回
        if (origin === 'list') {
            showAreaListForm(player);
        } else {
            showMainForm(player);
        }
        return;
    }

    // 权限检查 (重要！)
    if (!checkPermission(player, areaData, areaId, "deleteArea")) {
        player.tell("§c你没有权限删除此区域！");
        showAreaOperateForm(player, areaId, origin);
        return;
    }


    const fm = mc.newCustomForm();
    fm.setTitle(`确认删除 ${area.name}`);

    // 计算退款金额并根据经济类型调整显示
    let refundText = "";
    if (config.enabled && area.price && area.price > 0) { // 确保价格存在且大于0
        const refundAmount = Math.floor(area.price * config.refundRate);
        const currencyName = config.type === "scoreboard" ? "点" : "金币";
        refundText = `§e你将获得 ${refundAmount} ${currencyName}退款（${config.refundRate * 100}%）`;
    } else {
        refundText = "§e删除此区域不会获得退款";
    }

    fm.addLabel("§c警告：此操作不可撤销！"); // index 0
    fm.addLabel(refundText); // index 1

    let confirmIndex = 2; // 默认确认开关索引

    // 如果是子区域，显示特别提示
    if(area.isSubarea) {
        fm.addLabel("§e这是一个子区域，删除后不会影响父区域。"); // index 2
        confirmIndex = 3;
    } else if(area.subareas && Object.keys(area.subareas).length > 0) {
        // 如果有子区域，显示警告
        const validSubareas = Object.keys(area.subareas).filter(id => areaData[id]).length;
        if (validSubareas > 0) {
            fm.addLabel(`§c警告：此区域有 ${validSubareas} 个子区域，删除主区域将同时删除所有子区域！`); // index 2 or 3
            confirmIndex = confirmIndex + 1; // 增加索引
        }
    }

    fm.addSwitch("我确认要删除这个区域", false); // index confirmIndex
    const backSwitchIndex = confirmIndex + 1; // 返回开关索引
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showAreaOperateForm(player, areaId, origin); // 取消返回
            return;
        }
        // 检查返回开关
        if(data[backSwitchIndex]) {
            showAreaOperateForm(player, areaId, origin);
            return;
        }

        if (data[confirmIndex]) { // 确认删除
            // 1. 先处理退款 (传递整个 area 对象)
            if (area.price && area.price > 0 && config.enabled) {
                handleAreaRefund(player, area); // handleAreaRefund 内部应使用 config
            }

            // 2. 再处理删除逻辑
            const parentAreaId = area.parentAreaId; // 保存父区域ID（如果存在）
            const isSub = area.isSubarea; // 保存是否是子区域

            // 如果是子区域，清理父区域中的引用
            if(isSub && parentAreaId && areaData[parentAreaId]) {
                const parentArea = areaData[parentAreaId];
                if(parentArea.subareas && parentArea.subareas[areaId]) {
                    delete parentArea.subareas[areaId];
                    logDebug(`从父区域 ${parentAreaId} 中移除子区域 ${areaId} 的引用`);
                }
            }

            // 如果是主区域且有子区域，递归删除所有子区域
            if(!isSub && area.subareas) {
                logInfo(`准备删除主区域 ${areaId} 及其子区域`);
                const subareaIdsToDelete = Object.keys(area.subareas);
                for(let subareaId of subareaIdsToDelete) {
                    if(areaData[subareaId]) {
                        logDebug(`删除子区域 ${subareaId}`);
                        delete areaData[subareaId];
                    } else {
                        logWarning(`尝试删除子区域 ${subareaId} 时未在 areaData 中找到`);
                    }
                }
            }

            // 删除区域本身
            logInfo(`删除区域 ${areaId}`);
            delete areaData[areaId];

            if (saveAreaData(areaData)) {
                player.tell("§a区域已成功删除！");
                updateAreaData(areaData); // 更新内存

                // 删除成功后的导航逻辑
                if(isSub && parentAreaId && areaData[parentAreaId]) {
                    // 如果是子区域，返回到父区域操作界面
                    player.tell("§e返回父区域管理界面...");
                    // 父区域的 origin 应该是什么？假设与子区域相同
                    showAreaOperateForm(player, parentAreaId, origin);
                } else {
                    // 如果是主区域或孤立子区域，根据 origin 返回
                    player.tell("§e返回上一级菜单...");
                    if (origin === 'list') {
                        showAreaListForm(player);
                    } else {
                        showMainForm(player);
                    }
                }
            } else {
                player.tell("§c删除区域时发生错误！");
                // 删除失败，返回当前区域的操作菜单（如果区域还存在）
                if (areaData[areaId]) {
                    showAreaOperateForm(player, areaId, origin);
                } else {
                    // 如果 areaData 中也没了，就返回上一级
                     if (origin === 'list') {
                        showAreaListForm(player);
                    } else {
                        showMainForm(player);
                    }
                }
            }
        } else {
            // 未确认删除
            player.tell("§e删除操作已取消。");
            showAreaOperateForm(player, areaId, origin);
        }
    });
}

// 添加 origin 参数
function confirmTransferArea(player, areaId, newOwnerData, origin) {
    // 获取区域数据
    const areaData = getAreaData(); // 添加这行来获取区域数据
    const area = areaData[areaId];

    if (!area) {
        player.tell("§c区域不存在！");
        showTransferAreaForm(player, areaId, origin); // 返回转让列表
        return;
    }
    if (!newOwnerData || !newOwnerData.uuid || !newOwnerData.name || !newOwnerData.xuid) {
         player.tell("§c无效的新主人数据！");
         showTransferAreaForm(player, areaId, origin); // 返回转让列表
         return;
    }

    // 权限检查
    if (!checkPermission(player, areaData, areaId, "transferArea")) {
        player.tell("§c你没有权限转让此区域！");
        showAreaOperateForm(player, areaId, origin); // 返回操作菜单
        return;
    }


    const fm = mc.newCustomForm();
    fm.setTitle("确认转让区域");
    fm.addLabel(`§c警告：你即将将区域 "${area.name}" 转让给 ${newOwnerData.name}`); // index 0
    fm.addLabel("§c此操作不可撤销！"); // index 1
    fm.addInput("§e输入 'confirm' 确认转让", "", ""); // index 2
    const backSwitchIndex = 3; // 返回开关索引
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showTransferAreaForm(player, areaId, origin); // 取消返回转让列表
            return;
        }
        // 检查返回开关
        if(data[backSwitchIndex]) {
            showTransferAreaForm(player, areaId, origin);
            return;
        }

        if (data[2].trim().toLowerCase() !== 'confirm') {
            player.tell("§c转让取消！未输入 'confirm'。");
            showTransferAreaForm(player, areaId, origin); // 返回转让列表
            return;
        }

        // 重新获取最新的区域数据
        const currentAreaData = getAreaData();
        const currentArea = currentAreaData[areaId];
        if (!currentArea) {
             player.tell("§c在确认转让时区域已消失！");
             showAreaOperateForm(player, areaId, origin); // 返回操作菜单
             return;
        }


        // 更新区域所有者信息
        currentArea.xuid = newOwnerData.xuid;
        currentArea.uuid = newOwnerData.uuid;
        currentArea.playerName = newOwnerData.name;

        // 保存区域数据
        if (saveAreaData(currentAreaData)) {
            player.tell("§a区域已成功转让！");
            updateAreaData(currentAreaData); // 更新内存
            // 尝试通知在线的新主人
            const newOwnerPlayer = mc.getPlayer(newOwnerData.uuid);
            if (newOwnerPlayer) {
                newOwnerPlayer.tell(`§a玩家 ${player.name} 已将区域 "${currentArea.name}" 转让给你！`);
            }

            // 清理临时绑定数据 (如果还在使用) - 看起来没用了，因为 newOwnerData 是直接传递的
            // player.setExtraData(`transfer_${newOwnerData.uuid}`, null);
        } else {
            player.tell("§c区域转让失败！");
        }

        showAreaOperateForm(player, areaId, origin); // 操作完成后返回操作菜单
    });
}

// 添加 origin 参数
function showTransferAreaForm(player, areaId, origin, currentPage = 0, filter = "") {
    const areaData = getAreaData();
    const area = areaData[areaId];

    // 检查是否是区域主人或有权限
    if(!checkPermission(player, areaData, areaId, "transferArea")) {
        player.tell("§c你没有权限转让区域！");
        showAreaOperateForm(player, areaId, origin); // 返回操作菜单
        return;
    }

    // 使用离线玩家数据API获取所有玩家数据
    const allPlayers = getOfflinePlayerData() || [];

    // 根据搜索关键词过滤玩家
    let filteredPlayers = allPlayers;
    if (filter.trim() !== "") {
        filteredPlayers = allPlayers.filter(p =>
            p.name.toLowerCase().includes(filter.toLowerCase()));
    }

    // 过滤掉当前区域主人
    filteredPlayers = filteredPlayers.filter(p => p.uuid !== player.uuid);

    // 为每个玩家绑定额外数据以便后续使用 - 不再需要，直接传递对象
    /*
    filteredPlayers.forEach(p => {
        player.setExtraData(`transfer_${p.uuid}`, {
            name: p.name,
            uuid: p.uuid,
            xuid: p.xuid
        });
    });
    */


    // 分页设置
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
    currentPage = Math.min(Math.max(0, currentPage), totalPages - 1); // 确保页码有效

    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredPlayers.length);
    const pagePlayers = filteredPlayers.slice(startIndex, endIndex);

    const fm = mc.newCustomForm();
    fm.setTitle(`${area.name} - 转让区域`);

    // 搜索框
    fm.addInput("搜索玩家", "输入玩家名称", filter); // index 0

    // 玩家列表
    const playerStartIndex = 1;
    for (let p of pagePlayers) {
        fm.addSwitch(
            `${p.name}`,
            false
        );
    }
    const confirmSwitchIndex = playerStartIndex + pagePlayers.length;
    const pageSliderIndex = confirmSwitchIndex + 1;
    const backSwitchIndex = pageSliderIndex + 1; // 返回开关索引

    // 确认转让开关
    fm.addSwitch("§c确认转让给选中的玩家", false); // index confirmSwitchIndex

    // 分页选择器
    const pageItems = Array.from({length: totalPages}, (_, i) => `第${i + 1}页`);
    fm.addStepSlider("选择页码", pageItems, currentPage); // index pageSliderIndex

    // 返回按钮
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showAreaOperateForm(player, areaId, origin); // 取消返回
            return;
        }
        // 检查返回开关
        if(data[backSwitchIndex]) {
            showAreaOperateForm(player, areaId, origin);
            return;
        }

        const keyword = data[0].trim();
        const confirmed = data[confirmSwitchIndex];
        const newPage = data[pageSliderIndex];

        // 处理页面切换或搜索
        if (keyword !== filter || newPage !== currentPage) {
            showTransferAreaForm(player, areaId, origin, newPage, keyword); // 传递 origin
            return;
        }

        // 检查选择的玩家
        let selectedPlayerData = null;
        let selectedCount = 0;
        for (let i = 0; i < pagePlayers.length; i++) {
            if (data[i + playerStartIndex]) {
                // 直接获取玩家完整数据
                selectedPlayerData = {
                    name: pagePlayers[i].name,
                    uuid: pagePlayers[i].uuid,
                    xuid: pagePlayers[i].xuid
                };
                selectedCount++;
            }
        }

        // 验证选择
        if (!confirmed) {
            player.tell("§e请勾选确认转让选项！");
            showTransferAreaForm(player, areaId, origin, currentPage, filter); // 重新显示
            return;
        }

        if (selectedCount !== 1) {
            player.tell("§c请只选择一个玩家作为新的区域主人！");
            showTransferAreaForm(player, areaId, origin, currentPage, filter); // 重新显示
            return;
        }

        // 确认转让
        confirmTransferArea(player, areaId, selectedPlayerData, origin); // 传递 origin 和玩家数据
    });
}

// 添加 origin 参数
function showAreaRulesForm(player, areaId, origin) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    if(!checkPermission(player, areaData, areaId, "setAreaRules")) {
        player.tell("§c你没有权限设置区域规则！");
        showAreaOperateForm(player, areaId, origin); // 返回
        return;
    }
    // 初始化规则对象
    if(!area.rules) {
        area.rules = {}; // Start empty, add defaults below
    }

    // Define default rules
    const defaultRules = {
        allowCreeperExplosion: false,
        allowFireballExplosion: false,
        allowCrystalExplosion: false,
        allowWitherExplosion: false,
        allowWitherSkullExplosion: false,
        allowTntMinecartExplosion: false,
        allowWindChargeExplosion: false,
        allowBreezeWindChargeExplosion: false,
        allowOtherExplosion: false,
        allowBlockExplosion: false,
        allowFireSpread: false,
        allowFireBurnBlock: false,
        allowMossGrowth: false,
        allowSculkSpread: false,
        allowLiquidFlow: false,
        allowEntityPressurePlate: false,
        allowEntityRide: false,
        allowWitherDestroy: false,
        allowMobNaturalSpawn: false,
        allowEndermanTakeBlock: false,
        allowEndermanPlaceBlock: false,
        allowExplosionDamageBlock: false,
        allowFarmlandDecay: false,
        allowDragonEggTeleport: false, // 新增：允许龙蛋传送
        displayTitle: true,
        displayActionBar: true,
        mobSpawnExceptions: [], // Ensure array exists
    };

    // Apply defaults for missing rules
    for (const ruleKey in defaultRules) {
        if (area.rules[ruleKey] === undefined) {
            area.rules[ruleKey] = defaultRules[ruleKey];
        }
    }


    const fm = mc.newCustomForm();
    fm.setTitle(`${area.name} - 区域规则设置`);

    // 添加规则开关 - 使用 Object.keys 保证顺序和完整性
    const ruleKeys = Object.keys(defaultRules).filter(key => typeof defaultRules[key] === 'boolean');
    const ruleLabels = { // More descriptive labels
        allowCreeperExplosion: "允许苦力怕爆炸",
        allowFireballExplosion: "允许火球爆炸",
        allowCrystalExplosion: "允许末影水晶爆炸",
        allowWitherExplosion: "允许凋灵爆炸",
        allowWitherSkullExplosion: "允许凋灵头颅爆炸",
        allowTntMinecartExplosion: "允许TNT矿车爆炸",
        allowWindChargeExplosion: "允许风弹爆炸",
        allowBreezeWindChargeExplosion: "允许旋风人风弹爆炸",
        allowOtherExplosion: "允许其他类型爆炸",
        allowBlockExplosion: "允许方块爆炸 (如床)",
        allowFireSpread: "允许火焰蔓延",
        allowFireBurnBlock: "允许火焰烧毁方块",
        allowMossGrowth: "允许苔藓生长",
        allowSculkSpread: "允许幽匿蔓延",
        allowLiquidFlow: "允许区域外液体流入",
        allowEntityPressurePlate: "允许实体踩压力板",
        allowEntityRide: "允许生物乘骑",
        allowWitherDestroy: "允许凋灵破坏方块",
        allowMobNaturalSpawn: "允许自然生成生物",
        allowEndermanTakeBlock: "允许末影人拿起方块",
        allowEndermanPlaceBlock: "允许末影人放置方块",
        allowExplosionDamageBlock: "允许爆炸破坏区域内方块",
        allowFarmlandDecay: "允许耕地被踩踏破坏",
        allowDragonEggTeleport: "允许龙蛋传送", // 新增：龙蛋传送标签
        displayTitle: "§b允许显示进入区域标题",
        displayActionBar: "§b允许在物品栏上方显示区域信息",
    };

    ruleKeys.forEach(key => {
        fm.addSwitch(ruleLabels[key] || key, area.rules[key]);
    });

    // 生物生成例外
    const exceptionLabelIndex = ruleKeys.length;
    const exceptionInputIndex = exceptionLabelIndex + 1;
    const backSwitchIndex = exceptionInputIndex + 1; // 返回开关索引

    fm.addLabel("§e--- 生物生成例外 ---"); // index exceptionLabelIndex
    fm.addInput("例外实体类型 (逗号分隔)", "例如: minecraft:zombie,minecraft:skeleton", (area.rules.mobSpawnExceptions || []).join(',')); // index exceptionInputIndex
    fm.addSwitch("§c返回", false); // index backSwitchIndex


    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showAreaOperateForm(player, areaId, origin); // 取消返回
            return;
        }
        // 检查返回开关
        if(data[backSwitchIndex]) {
            showAreaOperateForm(player, areaId, origin);
            return;
        }

        // 保存规则设置
        ruleKeys.forEach((key, index) => {
            area.rules[key] = data[index];
        });

        // 解析并保存例外实体列表
        const exceptionsInput = data[exceptionInputIndex] || "";
        area.rules.mobSpawnExceptions = exceptionsInput.split(',')
            .map(s => s.trim().toLowerCase()) // Trim and lowercase
            .filter(s => s !== ""); // Filter empty strings

        if(saveAreaData(areaData)) {
            player.tell("§a区域规则设置已保存！");
            updateAreaData(areaData); // 关键修复：更新内存中的区域数据
        } else {
            player.tell("§c保存区域规则失败！");
        }

        showAreaOperateForm(player, areaId, origin); // 操作完成后返回
    });
}

module.exports = {
    confirmResizeArea,
    showRenameForm,
    confirmDeleteArea,
    confirmTransferArea,
    showTransferAreaForm,
    showAreaRulesForm
};
