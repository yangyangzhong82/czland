// mainForm.js
const { loadAreaData, saveAreaData } = require('./config');
const { getAreaData } = require('./czareaprotection');
const { isInArea } = require('./utils');
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
const { getPlayerCustomGroups, createCustomGroup, editCustomGroup, deleteCustomGroup } = require('./customGroups');
const { checkPermission, setPlayerPermission, getPlayerPermission, getAvailableGroups, DEFAULT_GROUPS,  getAreaDefaultGroup, setAreaDefaultGroup } = require('./permission');
const { getPlayerData } = require('./playerDataManager');
const { calculateAreaPrice, handleAreaPurchase, handleAreaRefund } = require('./economy');
// LiteLoader-AIDS automatic generated
/// <reference path="d:\mc\插件/dts/HelperLib-master/src/index.d.ts"/> 
const { loadConfig } = require('./configManager');
const { showSubAreaManageForm } = require('./subareaForms');


function showMainForm(player) {
    const fm = mc.newSimpleForm();
    fm.setTitle("区域管理系统");
    fm.addButton("管理脚下区域");
    fm.addButton("区域列表");
    
    player.sendForm(fm, (player, id) => {
        if (id === null) return; // 玩家取消表单返回null
        
        switch (id) {
            case 0:
                handleCurrentArea(player);
                break;
            case 1:
                showAreaListForm(player);
                break;
        }
    });
}

function handleCurrentArea(player) {
    const pos = player.pos;
    const areaData = getAreaData();
    const { getPriorityAreasAtPosition } = require('./utils');
    
    // 获取玩家位置的所有区域（已按优先级排序）
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData);
    
    if (areasAtPos.length === 0) {
        player.tell("§c你当前不在任何区域内！");
        return;
    }
    
    // 如果只有一个区域，直接进入操作界面
    if (areasAtPos.length === 1) {
        showAreaOperateForm(player, areasAtPos[0].id);
        return;
    }
    
    // 如果有多个区域，显示选择表单
    const fm = mc.newSimpleForm();
    fm.setTitle("选择要管理的区域");
    fm.setContent("§e你当前位置有多个重叠的区域，请选择要管理的区域：");
    
    // 添加区域按钮
    for (let areaInfo of areasAtPos) {
        const area = areaInfo.area;
        let buttonText = `${area.name}`;
        
        // 如果是子区域，显示父区域信息
        if (areaInfo.isSubarea && areaInfo.parentAreaId) {
            const parentArea = areaData[areaInfo.parentAreaId];
            if (parentArea) {
                buttonText += ` §7(${parentArea.name}的子区域)`;
            }
        }
        
        // 如果是主区域且有子区域，显示提示
        if (!areaInfo.isSubarea && area.subareas && Object.keys(area.subareas).length > 0) {
            buttonText += ` §7(含${Object.keys(area.subareas).length}个子区域)`;
        }
        
        fm.addButton(buttonText);
    }
    
    player.sendForm(fm, (player, id) => {
        if (id === null) return; // 玩家取消表单
        
        // 获取选择的区域ID
        const selectedAreaId = areasAtPos[id].id;
        showAreaOperateForm(player, selectedAreaId);
    });
}

function showAreaListForm(player, currentPage = 0, filter = "") {
    // 收集玩家拥有的区域
    const areaData = getAreaData();
    let allAreas = [];
    for (let id in areaData) {
        // 使用正确的checkPermission调用
        if (checkPermission(player, areaData, id, "manage")) {
            let area = areaData[id];
            area.id = id;
            allAreas.push(area);
        }
    }
    
    // 根据搜索关键词过滤区域
    let filteredAreas = allAreas;
    if (filter.trim() !== "") {
        filteredAreas = allAreas.filter(area => 
            (area.name || "").toLowerCase().includes(filter.toLowerCase()) ||
            (area.id || "").toLowerCase().includes(filter.toLowerCase()));
    }
    
    // 分页设置
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(filteredAreas.length / pageSize));
    currentPage = Math.min(currentPage, totalPages - 1);
    
    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredAreas.length);
    const pageAreas = filteredAreas.slice(startIndex, endIndex);
    
    // 创建表单
    const fm = mc.newCustomForm();
    fm.setTitle("区域列表");
    
    // 搜索框
    fm.addInput("搜索区域", "输入区域名称或ID", filter);
    
    // 区域列表
    for (let area of pageAreas) {
        fm.addSwitch(
            `${area.name} (ID: ${area.id})`,
            false
        );
    }
    
    // 完成选择开关
    fm.addSwitch("完成选择", false);
    
    // 分页选择器
    const pageItems = Array.from({length: totalPages}, (_, i) => `第${i + 1}页`);
    fm.addStepSlider("选择页码", pageItems, currentPage);
    
    // 发送表单
    player.sendForm(fm, (player, data) => {
        if (data === null) return;
        
        const keyword = data[0].trim();
        const selectedAreas = [];
        
        // 收集选中的区域
        for (let i = 0; i < pageAreas.length; i++) {
            if (data[i + 1] === true) {
                selectedAreas.push(pageAreas[i].id);
            }
        }
        
        const completeSwitch = data[pageAreas.length + 1];
        const newPage = data[pageAreas.length + 2];
        
        // 处理表单结果
        if (completeSwitch && selectedAreas.length === 1) {
            showAreaOperateForm(player, selectedAreas[0]);
            return;
        }
        
        if (keyword !== filter) {
            showAreaListForm(player, 0, keyword);
            return;
        }
        
        if (newPage !== currentPage) {
            showAreaListForm(player, newPage, filter);
            return;
        }
        
        player.tell("§e请选择一个区域并点击完成选择。");
    });
}
function hasPermission(player, areaId, permission) {
    const areaData = getAreaData();
    return checkPermission(player, areaData, areaId, permission);
}

function showAreaOperateForm(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    if (!area) {
        player.tell("§c区域不存在！");
        return;
    }

    const fm = mc.newSimpleForm();
    fm.setTitle(`${area.name} - 操作菜单`);
    fm.addButton("查看信息");
    
    // 只有有manage权限的玩家才能看到这些按钮
    if(checkPermission(player, areaData, areaId, "manage")) {
        fm.addButton("修改名称");
        fm.addButton("管理权限");
        fm.addButton("删除区域");
        fm.addButton("权限组管理");
        fm.addButton("区域规则设置");
        fm.addButton("重新设置区域范围");
        fm.addButton("转让区域");
        fm.addButton("子区域管理"); // 添加子区域管理按钮
    }

    player.sendForm(fm, (player, id) => {
        if (id === null) return;
        
        switch (id) {
            case 0:
                showAreaInfo(player, areaId);
                break;
            case 1:
                showRenameForm(player, areaId);
                break;
            case 2:
                showPermissionManageForm(player, areaId);
                break;
            case 3:
                confirmDeleteArea(player, areaId);
                break;
            case 4:
                showGroupManageForm(player,areaId); 
                break;
            case 5:
                showAreaRulesForm(player, areaId); 
                break;
            case 6:
                confirmResizeArea(player, areaId); 
                break;
            case 7:
                showTransferAreaForm(player, areaId); 
                break;
            case 8: 
                showSubAreaManageForm(player, areaId);
                break;
        }
    });
}



function confirmResizeArea(player, areaId) {
    const playerData = getPlayerData();
    if(!playerData[player.uuid] || !playerData[player.uuid].pos1 || !playerData[player.uuid].pos2) {
        player.tell("§c请先设置两个新的边界点！");
        return;
    }
    
    const point1 = playerData[player.uuid].pos1;
    const point2 = playerData[player.uuid].pos2;
    
    if(point1.dimid !== point2.dimid) {
        player.tell("§c两个点必须在同一维度！");
        return;
    }
    
    // 获取区域数据
    const areaData = getAreaData();
    const area = areaData[areaId];
    
    if(!area) {
        player.tell("§c无法找到该区域！");
        return;
    }
    
    // 创建新区域临时对象用于检查重叠
    const newAreaTemp = {
        point1: {
            x: point1.x,
            y: point1.y,
            z: point1.z
        },
        point2: {
            x: point2.x,
            y: point2.y,
            z: point2.z
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
    const { checkNewAreaOverlap } = require('./utils');
    const overlapCheck = checkNewAreaOverlap(newAreaTemp, areasToCheck);
    if(overlapCheck.overlapped) {
        player.tell(`§c无法调整区域范围：与现有区域 "${overlapCheck.overlappingArea.name}" 重叠！`);
        return;
    }
    const { loadConfig } = require('./configManager');
    const { checkAreaSizeLimits } = require('./utils');
    const config = loadConfig();
    const sizeCheck = checkAreaSizeLimits(point1, point2, config, area.isSubarea);
    
    if (!sizeCheck.valid) {
        player.tell(`§c无法调整区域范围: ${sizeCheck.message}`);
        return;
    }    
    
    let originalPrice = 0;
    let newPrice = 0;
    let priceDifference = 0;
    let priceText = "";
    
    if(config.economy && config.economy.enabled) {
        // 计算原区域的价格
        originalPrice = area.price || calculateAreaPrice(area.point1, area.point2);
        
        // 计算新区域的价格
        newPrice = calculateAreaPrice(point1, point2);
        
        // 计算价格差异
        priceDifference = newPrice - originalPrice;
        
        if(priceDifference > 0) {
            // 新区域更大，需要额外付费
            priceText = `§e新区域比原区域更大，需要额外支付 ${priceDifference} 金币`;
        } else if(priceDifference < 0) {
            // 新区域更小，可以获得退款
            priceText = `§e新区域比原区域更小，你将获得 ${Math.abs(priceDifference)} 金币退款`;
        } else {
            priceText = "§e区域价格没有变化";
        }
    }
    
    const fm = mc.newCustomForm();
    fm.setTitle("确认修改区域范围");
    fm.addLabel(`新的区域范围将为：\n从(${point1.x}, ${point1.y}, ${point1.z})\n到(${point2.x}, ${point2.y}, ${point2.z})`);
    fm.addLabel(`所在维度：${point1.dimid}`);
    
    // 如果经济系统启用，显示价格变化信息
    if(config.economy && config.economy.enabled) {
        fm.addLabel(priceText);
    }
    
    fm.addSwitch("确认修改", false);
    
    player.sendForm(fm, (player, data) => {
        if(data === null) return;
        
        // 确定确认开关的索引
        const confirmIndex = config.economy && config.economy.enabled ? 3 : 2;
        
        if(!data[confirmIndex]) {
            // 用户未确认修改
            showAreaOperateForm(player, areaId);
            return;
        }
        
        // 检查经济系统
        if(config.economy && config.economy.enabled && priceDifference > 0) {
            // 如果新区域更大，需要额外付费
            const playerMoney = money.get(player.xuid);
            if(playerMoney < priceDifference) {
                player.tell(`§c你的余额不足！需要额外支付 ${priceDifference} 金币，当前余额 ${playerMoney} 金币`);
                return;
            }
            
            // 扣除额外费用
            if(!money.reduce(player.xuid, priceDifference)) {
                player.tell("§c扣款失败，请联系管理员");
                return;
            }
            
            player.tell(`§a成功支付额外费用 ${priceDifference} 金币`);
        }
        
        // 重新获取区域数据以确保使用最新数据
        const updatedAreaData = getAreaData();
        const currentArea = updatedAreaData[areaId];
        
        // 保存新的区域范围
        currentArea.point1 = {
            x: point1.x,
            y: point1.y,
            z: point1.z
        };
        currentArea.point2 = {
            x: point2.x,
            y: point2.y,
            z: point2.z
        };
        currentArea.dimid = point1.dimid;
        
        // 更新区域价格
        if(config.economy && config.economy.enabled) {
            currentArea.price = newPrice;
            
            // 如果新区域更小，提供退款
            if(priceDifference < 0) {
                if(money.add(player.xuid, Math.abs(priceDifference))) {
                    player.tell(`§a已退还 ${Math.abs(priceDifference)} 金币`);
                } else {
                    player.tell("§c退款失败，请联系管理员");
                }
            }
        }
        
        if(saveAreaData(updatedAreaData)) {
            player.tell("§a区域范围已成功更新！");
            // 清除临时数据
            delete playerData[player.uuid].pos1;
            delete playerData[player.uuid].pos2;
        } else {
            player.tell("§c更新区域范围失败！");
        }
        
        showAreaOperateForm(player, areaId);
    });
}

function showRenameForm(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    
    // 检查权限
    if(!checkPermission(player, areaData, areaId, "rename")) {
        player.tell("§c你没有权限修改区域名称！");
        return;
    }
    
    const fm = mc.newCustomForm();
    fm.setTitle(`修改区域名称 - ${area.name}`);
    fm.addInput("新名称", "请输入新的区域名称", area.name);
    
    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showAreaOperateForm(player, areaId);
            return;
        }
        
        const newName = data[0].trim();
        if(!newName) {
            player.tell("§c区域名称不能为空！");
            return;
        }
        
        // 保存新名称
        area.name = newName;
        if(saveAreaData(areaData)) {
            player.tell("§a区域名称修改成功！");
        } else {
            player.tell("§c区域名称修改失败！");
        }
        
        showAreaOperateForm(player, areaId);
    });
}

function showAreaInfo(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    
    const fm = mc.newSimpleForm();
    fm.setTitle(`${area.name} - 详细信息`);
    fm.addButton(`区域ID: ${areaId}`);
    fm.addButton(`创建时间: ${new Date(area.createTime).toLocaleString()}`);
    fm.addButton(`位置: (${area.point1.x}, ${area.point1.y}, ${area.point1.z}) - (${area.point2.x}, ${area.point2.y}, ${area.point2.z})`);
    
    player.sendForm(fm, (player, id) => {
        if (id === null) return;
        showAreaOperateForm(player, areaId);
    });
}

function confirmDeleteArea(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    
    const fm = mc.newCustomForm();
    fm.setTitle(`确认删除 ${area.name}`);
    
    // 计算退款金额
    const refundText = area.price 
        ? `§e你将获得 ${Math.floor(area.price * loadConfig().economy.refundRate)} 金币退款（${loadConfig().economy.refundRate * 100}%）`
        : "§e删除此区域不会获得退款";
    
    fm.addLabel("§c警告：此操作不可撤销！");
    fm.addLabel(refundText);
    
    // 如果是子区域，显示特别提示
    if(area.isSubarea) {
        fm.addLabel("§e这是一个子区域，删除后不会影响父区域。");
    } else if(area.subareas && Object.keys(area.subareas).length > 0) {
        // 如果有子区域，显示警告
        const validSubareas = Object.keys(area.subareas).filter(id => areaData[id]).length;
        fm.addLabel(`§c警告：此区域有 ${validSubareas} 个子区域，删除主区域将同时删除所有子区域！`);
    }
    
    fm.addSwitch("我确认要删除这个区域", false);
    
    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showAreaOperateForm(player, areaId);
            return;
        }
        
        // 确认删除开关的索引会因为条件性标签而变化
        let confirmIndex = 2;
        if(area.isSubarea || (area.subareas && Object.keys(area.subareas).length > 0)) {
            confirmIndex = 3;
        }
        
        if (data[confirmIndex]) { // 确认删除
            // 处理退款
            if (area.price) {
                handleAreaRefund(player, area.point1, area.point2);
            }
            
            // 如果是子区域，清理父区域中的引用
            if(area.isSubarea && area.parentAreaId && areaData[area.parentAreaId]) {
                const parentArea = areaData[area.parentAreaId];
                if(parentArea.subareas && parentArea.subareas[areaId]) {
                    delete parentArea.subareas[areaId];
                }
            }
            
            // 如果是主区域且有子区域，递归删除所有子区域
            if(!area.isSubarea && area.subareas) {
                for(let subareaId in area.subareas) {
                    if(areaData[subareaId]) {
                        delete areaData[subareaId];
                    }
                }
            }
            
            // 删除区域
            delete areaData[areaId];
            if (saveAreaData(areaData)) {
                player.tell("§a区域已成功删除！");
                const { updateAreaData } = require('./czareaprotection');
                updateAreaData(areaData);
                
                // 如果是子区域，返回到父区域操作界面
                if(area.isSubarea && area.parentAreaId && areaData[area.parentAreaId]) {
                    showAreaOperateForm(player, area.parentAreaId);
                }
            } else {
                player.tell("§c删除区域时发生错误！");
            }
        } else {
            showAreaOperateForm(player, areaId);
        }
    });
}

function showTransferAreaForm(player, areaId, currentPage = 0, filter = "") {
    const areaData = getAreaData();
    const area = areaData[areaId];
    
    // 检查是否是区域主人
    if(area.xuid !== player.xuid) {
        player.tell("§c只有区域主人才能转让区域！");
        return;
    }
    
    // 使用离线玩家数据API获取所有玩家数据
    const allPlayers = getOfflinePlayerData(); // 这里使用离线玩家数据API
    
    // 根据搜索关键词过滤玩家
    let filteredPlayers = allPlayers;
    if (filter.trim() !== "") {
        filteredPlayers = allPlayers.filter(p => 
            p.name.toLowerCase().includes(filter.toLowerCase()));
    }
    
    // 过滤掉当前区域主人
    filteredPlayers = filteredPlayers.filter(p => p.uuid !== player.uuid);
    
    // 为每个玩家绑定额外数据以便后续使用
    filteredPlayers.forEach(p => {
        player.setExtraData(`transfer_${p.uuid}`, {
            name: p.name,
            uuid: p.uuid,
            xuid: p.xuid
        }); 
    });

    
    // 分页设置
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
    currentPage = Math.min(currentPage, totalPages - 1);
    
    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredPlayers.length);
    const pagePlayers = filteredPlayers.slice(startIndex, endIndex);
    
    const fm = mc.newCustomForm();
    fm.setTitle(`${area.name} - 转让区域`);
    
    // 搜索框
    fm.addInput("搜索玩家", "输入玩家名称", filter);
    
    // 玩家列表
    for (let p of pagePlayers) {
        fm.addSwitch(
            `${p.name}`,
            false
        );
    }
    
    // 确认转让开关
    fm.addSwitch("§c确认转让区域", false);
    
    // 分页选择器
    const pageItems = Array.from({length: totalPages}, (_, i) => `第${i + 1}页`);
    fm.addStepSlider("选择页码", pageItems, currentPage);
    
    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showAreaOperateForm(player, areaId);
            return;
        }
        
        const keyword = data[0].trim();
        const confirmed = data[pagePlayers.length + 1];
        const newPage = data[pagePlayers.length + 2];
        
        // 处理页面切换或搜索
        if (keyword !== filter || newPage !== currentPage) {
            showTransferAreaForm(player, areaId, newPage, keyword);
            return;
        }
        
        // 检查选择的玩家
        let selectedPlayer = null;
        let selectedCount = 0;
        for (let i = 0; i < pagePlayers.length; i++) {
            if (data[i + 1]) {
                selectedPlayer = pagePlayers[i];
                selectedCount++;
            }
        }
        
        // 验证选择
        if (!confirmed) {
            player.tell("§e请确认转让选项！");
            return;
        }
        
        if (selectedCount !== 1) {
            player.tell("§c请选择一个玩家作为新的区域主人！");
            return;
        }
        
        // 确认转让
        confirmTransferArea(player, areaId, selectedPlayer);
    });
}

// 在 mainForm.js 中修改 confirmTransferArea 函数
function confirmTransferArea(player, areaId, newOwner) {
    // 获取区域数据
    const areaData = getAreaData(); // 添加这行来获取区域数据
    
    // 从玩家绑定数据中获取新主人信息
    const transferData = player.getExtraData(`transfer_${newOwner.uuid}`); 
    
    const fm = mc.newCustomForm();
    fm.setTitle("确认转让区域");
    fm.addLabel(`§c警告：你即将将区域 "${areaData[areaId].name}" 转让给 ${transferData.name}`);
    fm.addLabel("§c此操作不可撤销！");
    fm.addInput("§e输入 'confirm' 确认转让", "", "");
    
    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showTransferAreaForm(player, areaId);
            return;
        }
        
        if (data[2].trim().toLowerCase() !== 'confirm') {
            player.tell("§c转让取消！");
            return;
        }
        
        // 重新获取最新的区域数据
        const areaData = getAreaData();
        const area = areaData[areaId];
        
        // 更新区域所有者信息
        area.xuid = transferData.xuid;
        area.uuid = transferData.uuid;
        area.playerName = transferData.name;
        
        // 保存区域数据
        if (saveAreaData(areaData)) {
            player.tell("§a区域已成功转让！");
            const { updateAreaData } = require('./czareaprotection');
            updateAreaData(areaData);
            // 尝试通知在线的新主人
            const newOwnerPlayer = mc.getPlayer(transferData.uuid);
            if (newOwnerPlayer) {
                newOwnerPlayer.tell(`§a玩家 ${player.name} 已将区域 "${area.name}" 转让给你！`);
            }
            
            // 清理临时绑定数据
            player.setExtraData(`transfer_${transferData.uuid}`, null); 
        } else {
            player.tell("§c区域转让失败！");
        }
        
        showAreaOperateForm(player, areaId);
    });
}

function showPermissionManageForm(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    
    const fm = mc.newSimpleForm();
    fm.setTitle(`${area.name} - 权限管理`);
    fm.addButton("添加成员");
    fm.addButton("查看成员列表");
    fm.addButton("设置默认权限组");
    
    
    player.sendForm(fm, (player, id) => {
        if (id === null) return;
        
        switch (id) {
            case 0:
                showAddMemberForm(player, areaId);
                break;
            case 1:
                showMemberListForm(player, areaId);
                break;
            case 2:
                showAreaDefaultGroupForm(player, areaId); 
                break;
        }
    });
}

function showAddMemberForm(player, areaId, currentPage = 0, filter = "") {
    const areaData = getAreaData();
    const area = areaData[areaId];
    
    // 获取所有玩家数据
    const allPlayers = getOfflinePlayerData() || [];
    
    // 根据搜索关键词过滤玩家
    let filteredPlayers = allPlayers;
    if (filter.trim() !== "") {
        filteredPlayers = allPlayers.filter(p => 
            p.name.toLowerCase().includes(filter.toLowerCase()));
    }
    
    // 分页设置
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
    currentPage = Math.min(currentPage, totalPages - 1);
    
    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredPlayers.length);
    const pagePlayers = filteredPlayers.slice(startIndex, endIndex);
    
    const fm = mc.newCustomForm();
    fm.setTitle(`${area.name} - 添加成员`);
    
    // 搜索框
    fm.addInput("搜索玩家", "输入玩家名称", filter);
    
    // 玩家列表
    for (let p of pagePlayers) {
        fm.addSwitch(
            `${p.name}`,
            false
        );
    }
    
    // 权限组选择
    const groups = getAvailableGroups();
    const groupNames = Object.keys(groups)
        .filter(g => g !== 'owner') // 不显示owner组
        .map(g => `${g}(${groups[g].name})`);
    fm.addDropdown("选择权限组", groupNames);
    
    // 完成选择开关
    fm.addSwitch("确认添加", false);
    
    // 分页选择器
    const pageItems = Array.from({length: totalPages}, (_, i) => `第${i + 1}页`);
    fm.addStepSlider("选择页码", pageItems, currentPage);
    
    player.sendForm(fm, (player, data) => {
        if (data === null) return;
        
        const keyword = data[0].trim();
        const selectedGroup = Object.keys(groups).filter(g => g !== 'owner')[data[pagePlayers.length + 1]];
        const confirmed = data[pagePlayers.length + 2];
        const newPage = data[pagePlayers.length + 3];
        
        // 处理页面切换
        if (newPage !== currentPage || keyword !== filter) {
            showAddMemberForm(player, areaId, newPage, keyword);
            return;
        }
        
        // 处理添加成员
        if (confirmed) {
            let added = 0;
            for (let i = 0; i < pagePlayers.length; i++) {
                if (data[i + 1]) { // 如果该玩家被选中
                    const targetXuid = pagePlayers[i].uuid;
                    if (setPlayerPermission(areaData, areaId, targetXuid, selectedGroup)) {
                        added++;
                    }
                }
            }
            
            // 保存数据
            if (added > 0 && saveAreaData(areaData)) {
                player.tell(`§a成功添加${added}个成员到权限组${groups[selectedGroup].name}`);
            }
            
            showPermissionManageForm(player, areaId);
            return;
        }
        
        player.tell("§e请选择玩家并确认添加。");
    });
}

// 显示成员列表表单
function showMemberListForm(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    const permissions = area.permissions || {};
    
    const fm = mc.newSimpleForm();
    fm.setTitle(`${area.name} - 成员列表`);
    
    // 获取所有玩家数据用于显示名称
    const allPlayers = getOfflinePlayerData() || [];
    const playerMap = {};
    allPlayers.forEach(p => playerMap[p.uuid] = p.name);
    
    // 显示所有成员
    for (let uuid in permissions) {
        const group = permissions[uuid];
        const name = playerMap[uuid] || "未知玩家";
        fm.addButton(`${name}\n§r§7权限组: ${getAvailableGroups()[group].name}`);
    }
    
    player.sendForm(fm, (player, id) => {
        if (id === null) return;
        // 点击成员可以修改或移除权限
        const targetXuid = Object.keys(permissions)[id];
        showMemberEditForm(player, areaId, targetXuid);
    });
}

// 显示权限组管理主界面
function showGroupManageForm(player,areaId) {
    const fm = mc.newSimpleForm();
    fm.setTitle("权限组管理");
    fm.addButton("创建新权限组");
    fm.addButton("管理现有权限组");
    fm.addButton("设置默认权限组");
    
    player.sendForm(fm, (player, id) => {
        if(id === null) return;
        
        switch(id) {
            case 0:
                showCreateGroupForm(player);
                break;
            case 1:
                showGroupListForm(player);
                break;
            case 2:
                showDefaultGroupForm(player, areaId); // 新增处理
                break;
        }
    });
}

function showCreateGroupForm(player) {
    const { getPermissionsByCategory, getAllCategories } = require('./permissionRegistry');
    
    const fm = mc.newCustomForm();
    fm.setTitle("创建权限组");
    fm.addInput("权限组ID", "例如: vip");
    fm.addInput("显示名称", "例如: VIP会员");
    
    fm.addLabel("§7注意：直接选择所有需要的权限");
    
    // 存储权限和表单索引的映射
    let permissionFormIndexes = new Map();
    let currentIndex = 3; // 从3开始,因为前面有两个输入框和一个标签
    
    // 按分类添加权限选择
    const categories = getAllCategories();
    categories.forEach(category => {
        fm.addLabel(`§l§6${category}权限`);
        currentIndex++;
        
        const permsInCategory = getPermissionsByCategory()[category] || [];
        permsInCategory.forEach(perm => {
            fm.addSwitch(`${perm.name}: §7${perm.description}`, false);
            permissionFormIndexes.set(currentIndex, perm.id);
            currentIndex++;
        });
    });
    
    player.sendForm(fm, (player, data) => {
        if(data === null) return;
        
        const groupId = data[0].trim();
        const displayName = data[1].trim();
        
        if(!groupId || !displayName) {
            player.tell("§c权限组ID和显示名称不能为空！");
            return;
        }
        
        // 收集选中的权限
        const permissions = [];
        permissionFormIndexes.forEach((permId, index) => {
            if(data[index] === true) {
                logger.info(`选中权限: ${permId}`);
                permissions.push(permId);
            }
        });
        
        logger.info(`创建权限组: ${groupId}, 权限: ${JSON.stringify(permissions)}`);
        
        // 创建自定义权限组 
        if(createCustomGroup(player.uuid, groupId, displayName, permissions, null)) {
            player.tell(`§a权限组创建成功！\n§7包含权限: ${permissions.join(', ')}`);
            
            // 验证保存结果
            const groups = getPlayerCustomGroups(player.uuid);
            if(groups[groupId]) {
                logger.info(`已保存权限组: ${JSON.stringify(groups[groupId])}`);
            }
        } else {
            player.tell("§c权限组创建失败！");
        }
    });
}

// 设置默认权限组的表单
function showAreaDefaultGroupForm(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    
    // 检查玩家是否是区域所有者
    if(area.xuid !== player.xuid) {
        player.tell("§c只有区域创建者才能修改默认权限组！");
        showPermissionManageForm(player, areaId);
        return;
    }
    
    const fm = mc.newCustomForm();
    fm.setTitle("设置区域默认权限组");
    
    // 获取所有可用的权限组（仅包括自定义权限组）
    const groups = getAvailableGroups();
    const groupNames = Object.keys(groups).map(g => `${g}(${groups[g].name})`);
    
    // 添加一个"使用系统默认权限"选项
    groupNames.unshift("使用系统默认权限");
    
    // 获取当前的默认权限组
    const currentDefault = getAreaDefaultGroup(areaId);
    let currentIndex = currentDefault ? Object.keys(groups).indexOf(currentDefault) + 1 : 0;
    if (currentIndex < 0) currentIndex = 0;
    
    fm.addLabel("§e选择一个权限组作为该区域的默认权限组\n§7未设置特定权限组的玩家将使用此权限组");
    fm.addDropdown("选择默认权限组", groupNames, currentIndex);
    
    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showPermissionManageForm(player, areaId);
            return;
        }
        
        if (data[1] === 0) {
            // 选择使用系统默认权限
            const success = setAreaDefaultGroup(areaId, null);
            if(success) {
                player.tell(`§a已设置区域使用系统默认权限`);
            } else {
                player.tell("§c设置默认权限组失败！");
            }
        } else {
            // 选择使用自定义权限组
            const selectedGroup = Object.keys(groups)[data[1] - 1];
            const success = setAreaDefaultGroup(areaId, selectedGroup);
            if(success) {
                player.tell(`§a已将区域默认权限组设置为: ${groups[selectedGroup].name}`);
            } else {
                player.tell("§c设置默认权限组失败！");
            }
        }
        
        showPermissionManageForm(player, areaId);
    });
}
//权限组编辑表单
function showGroupEditForm(player, groupId) {
    const { getPermissionsByCategory, getAllCategories } = require('./permissionRegistry');
    
    const groups = getPlayerCustomGroups(player.uuid);
    const group = groups[groupId];
    
    const fm = mc.newCustomForm();
    fm.setTitle(`编辑权限组 - ${group.name}`);
    fm.addInput("显示名称", "权限组显示名称", group.name);
    
    fm.addLabel("§7注意：直接选择所有需要的权限");
    
    // 存储权限和表单索引的映射 
    let permissionFormIndexes = new Map();
    let currentIndex = 2; // 从2开始,因为前面有一个输入框和一个标签
    
    // 按分类添加权限选择
    const categories = getAllCategories();
    categories.forEach(category => {
        fm.addLabel(`§l§6${category}权限`);
        currentIndex++;
        
        const permsInCategory = getPermissionsByCategory()[category] || [];
        permsInCategory.forEach(perm => {
            const isPermSelected = group.permissions.includes(perm.id);
            fm.addSwitch(`${perm.name}: §7${perm.description}`, isPermSelected);
            permissionFormIndexes.set(currentIndex, perm.id);
            currentIndex++;
        });
    });
    
    fm.addSwitch("§c删除此权限组", false);
    
    player.sendForm(fm, (player, data) => {
        if(data === null) return;
        
        // 检查是否要删除
        if(data[data.length - 1]) {
            if(deleteCustomGroup(player.uuid, groupId)) {
                player.tell("§a权限组已删除！");
            }
            return;
        }
        
        const newName = data[0].trim();
        if(!newName) {
            player.tell("§c显示名称不能为空！");
            return;
        }
        
        // 收集选中的权限
        const permissions = [];
        permissionFormIndexes.forEach((permId, index) => {
            if(data[index] === true) {
                logger.info(`选中权限: ${permId}`);
                permissions.push(permId);
            }
        });
        
        logger.info(`编辑权限组: ${groupId}, 新权限: ${JSON.stringify(permissions)}`);
        
        // 保存修改
        if(editCustomGroup(player.uuid, groupId, newName, permissions, null)) {
            player.tell(`§a权限组修改成功！\n§7包含权限: ${permissions.join(', ')}`);
            
            // 验证保存结果
            const updatedGroups = getPlayerCustomGroups(player.uuid);
            if(updatedGroups[groupId]) {
                logger.info(`已更新权限组: ${JSON.stringify(updatedGroups[groupId])}`);
            }
        } else {
            player.tell("§c权限组修改失败！");
        }
    });
}

// 显示权限组列表
function showGroupListForm(player) {
    const groups = getPlayerCustomGroups(player.uuid);
    
    const fm = mc.newSimpleForm();
    fm.setTitle("我的权限组");
    
    for(let groupId in groups) {
        const group = groups[groupId];
        fm.addButton(`${group.name}\n§7权限: ${group.permissions.join(", ")}`);
    }
    
    player.sendForm(fm, (player, id) => {
        if(id === null) return;
        
        const groupId = Object.keys(groups)[id];
        showGroupEditForm(player, groupId);
    });
}

function showAreaRulesForm(player, areaId) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    
    // 初始化规则对象
    if(!area.rules) {
        area.rules = {
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
            allowFireBurnBlock: false
        };
    }
    
    const fm = mc.newCustomForm();
    fm.setTitle(`${area.name} - 区域规则设置`);
    
    // 添加规则开关
    fm.addSwitch("允许苦力怕爆炸", area.rules.allowCreeperExplosion);
    fm.addSwitch("允许火球爆炸", area.rules.allowFireballExplosion);
    fm.addSwitch("允许末影水晶爆炸", area.rules.allowCrystalExplosion);
    fm.addSwitch("允许凋灵爆炸", area.rules.allowWitherExplosion);
    fm.addSwitch("允许凋灵头颅爆炸", area.rules.allowWitherSkullExplosion);
    fm.addSwitch("允许TNT矿车爆炸", area.rules.allowTntMinecartExplosion);
    fm.addSwitch("允许风弹爆炸", area.rules.allowWindChargeExplosion);
    fm.addSwitch("允许旋风人风弹爆炸", area.rules.allowBreezeWindChargeExplosion);
    fm.addSwitch("允许其他类型爆炸", area.rules.allowOtherExplosion);
    fm.addSwitch("允许方块爆炸", area.rules.allowBlockExplosion);
    fm.addSwitch("允许火焰蔓延", area.rules.allowFireSpread);
    fm.addSwitch("允许火焰烧毁方块", area.rules.allowFireBurnBlock);

    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showAreaOperateForm(player, areaId);
            return;
        }
        
        // 保存规则设置
        area.rules.allowCreeperExplosion = data[0];
        area.rules.allowFireballExplosion = data[1];
        area.rules.allowCrystalExplosion = data[2];
        area.rules.allowWitherExplosion = data[3];
        area.rules.allowWitherSkullExplosion = data[4];
        area.rules.allowTntMinecartExplosion = data[5];
        area.rules.allowWindChargeExplosion = data[6];
        area.rules.allowBreezeWindChargeExplosion = data[7];
        area.rules.allowOtherExplosion = data[8];
        area.rules.allowBlockExplosion = data[9];
        area.rules.allowFireSpread = data[10];
        area.rules.allowFireBurnBlock = data[11];  
        if(saveAreaData(areaData)) {
            player.tell("§a区域规则设置已保存！");
            
            // 关键修复：更新内存中的区域数据
            const { updateAreaData } = require('./czareaprotection');
            updateAreaData(areaData);
        } else {
            player.tell("§c保存区域规则失败！");
        }
        
        showAreaOperateForm(player, areaId);
    });
}



// 导出函数
module.exports = {
    showMainForm
};