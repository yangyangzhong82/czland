// mainForm.js
const { loadAreaData, saveAreaData } = require('./config');
const { getAreaData } = require('./czareaprotection');
const { isInArea } = require('./utils'); // 不再需要 getAreaHierarchyPath
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
const { getPlayerCustomGroups, createCustomGroup, editCustomGroup, deleteCustomGroup, getAllCustomGroups } = require('./customGroups'); // Ensure getAllCustomGroups is imported if needed elsewhere, though getAvailableGroups uses it internally
const { checkPermission, setPlayerPermission, getPlayerPermission, getAvailableGroups, getAreaDefaultGroup, setAreaDefaultGroup, resetCache, groupHasAdminPermissions } = require('./permission'); // Removed DEFAULT_GROUPS import, Added resetCache, groupHasAdminPermissions
const { getPlayerData } = require('./playerDataManager');
const { calculateAreaPrice, handleAreaPurchase, handleAreaRefund } = require('./economy');
// LiteLoader-AIDS automatic generated
/// <reference path="d:\mc\插件/dts/HelperLib-master/src/index.d.ts"/>
const { loadConfig } = require('./configManager');
const { showSubAreaManageForm } = require('./subareaForms');
const { setAreaTeleportPoint, teleportPlayerToArea } = require('./teleport'); // 引入传送点功能
const {logDebug, logInfo, logWarning, logError } = require('./logger');


function showMainForm(player) {
    const fm = mc.newSimpleForm();
    fm.setTitle("区域管理系统");
    fm.addButton("管理脚下区域", "textures/items/compass_item"); // 更新指南针图标
    fm.addButton("区域列表", "textures/items/map_locked"); // 更新书本图标
    // 主菜单不需要返回按钮

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
    const areaData = getAreaData(); // 修正：添加分号
    const { getPriorityAreasAtPosition } = require('./utils');
    const { buildSpatialIndex } = require('./spatialIndex');

    // 构建空间索引
    const spatialIndex = buildSpatialIndex(areaData);

    // 将空间索引传递给 getPriorityAreasAtPosition
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex);

    if (areasAtPos.length === 0) {
        player.tell("§c你当前不在任何区域内！");
        showMainForm(player); // 返回主菜单
        return;
    }

    // 如果只有一个区域，直接进入操作界面
    if (areasAtPos.length === 1) {
        // 来源是 'main' 因为它是从主菜单的 "管理脚下区域" 进来的
        showAreaOperateForm(player, areasAtPos[0].id, 'main');
        return;
    }

    // 如果有多个区域，显示选择表单
    const fm = mc.newSimpleForm();
    fm.setTitle("选择要管理的区域");
    fm.setContent("§e你当前位置有多个重叠的区域，请选择要管理的区域：");

    // 添加区域按钮，只显示直接父区域（如果存在）
    for (let areaInfo of areasAtPos) {
        const area = areaInfo.area;
        let buttonText = `§b${area.name || `区域...${areaInfo.id.substring(areaInfo.id.length - 4)}`}`; // 默认显示区域自身名称
        const iconPath = "textures/ui/map_icon"; // 统一使用默认图标

        // 如果是子区域，在前面加上父区域名称
        if (areaInfo.isSubarea && areaInfo.parentAreaId) {
            const parentArea = areaData[areaInfo.parentAreaId];
            if (parentArea) {
                const parentName = parentArea.name || `区域...${areaInfo.parentAreaId.substring(areaInfo.parentAreaId.length - 4)}`;
                buttonText = `§b${parentName} / ${area.name || `区域...${areaInfo.id.substring(areaInfo.id.length - 4)}`}`; // 格式：父区域 / 子区域
            } else {
                 buttonText = `§c[父区域未找到] / ${area.name || `区域...${areaInfo.id.substring(areaInfo.id.length - 4)}`}`;
            }
        }

        // 如果是主区域且有子区域，仍然显示提示 (附加到末尾)
        // 注意：area.subareas 可能不是最新的，最好从 areaData 重新计算
        let subAreaCount = 0;
         if (!areaInfo.isSubarea) {
            for (const subId in areaData) {
                if (areaData[subId].isSubarea && areaData[subId].parentAreaId === areaInfo.id) {
                    subAreaCount++;
                }
            }
            if (subAreaCount > 0) {
                 buttonText += ` §7(含${subAreaCount}个子区域)`;
            }
         }


        // 所有按钮都使用统一图标
        fm.addButton(buttonText, iconPath);
    }
    fm.addButton("§c返回", "textures/ui/cancel");

    player.sendForm(fm, (player, id) => {
        if (id === null) {
             showMainForm(player); // 取消也返回主菜单
             return;
        }

        // 检查是否点击了返回按钮
        if (id === areasAtPos.length) {
            showMainForm(player);
            return;
        }

        // 获取选择的区域ID
        const selectedAreaId = areasAtPos[id].id;
        // 来源是 'main' 因为它是从主菜单的 "管理脚下区域" 进来的
        showAreaOperateForm(player, selectedAreaId, 'main');
    });
}

function showAreaListForm(player, currentPage = 0, filter = "", dimFilters = [], ownerFilters = []) {
    // 收集玩家拥有的区域 (只显示顶层区域或玩家直接拥有的子区域)
    const areaData = getAreaData();
    let displayableAreas = [];
    for (let id in areaData) {
        const area = areaData[id];
        // 检查管理权限
        if (checkPermission(player, areaData, id, "manage")) {
            // 如果是顶层区域，或者玩家是这个子区域的主人，则添加到列表
            // (或者根据需求调整：是否只显示顶层？)
            // 当前逻辑：显示所有有管理权限的区域，无论层级
            area.id = id; // 确保ID存在
            displayableAreas.push(area);
        }
    }

    // 获取所有玩家数据用于显示名称
    const allPlayers = getOfflinePlayerData() || [];
    const playerMap = {};
    allPlayers.forEach(p => playerMap[p.uuid] = p.name);

    // 根据搜索关键词过滤区域 (搜索区域名、ID、父区域名)
    let filteredAreas = displayableAreas;
    if (filter.trim() !== "") {
        const lowerFilter = filter.toLowerCase();
        filteredAreas = filteredAreas.filter(area => {
            const areaNameLower = (area.name || "").toLowerCase();
            const areaIdLower = (area.id || "").toLowerCase();
            let parentNameLower = "";
            if (area.isSubarea && area.parentAreaId && areaData[area.parentAreaId]) {
                parentNameLower = (areaData[area.parentAreaId].name || "").toLowerCase();
            }
            return areaNameLower.includes(lowerFilter) ||
                   areaIdLower.includes(lowerFilter) ||
                   (parentNameLower && parentNameLower.includes(lowerFilter)); // 也搜索父区域名
        });
    }

    // 根据维度过滤
    if (dimFilters.length > 0) {
        filteredAreas = filteredAreas.filter(area => dimFilters.includes(area.dimid));
    }

    // 根据区域主人过滤
    if (ownerFilters.length > 0) {
        filteredAreas = filteredAreas.filter(area => {
            const ownerName = playerMap[area.uuid] || area.playerName || "";
            return ownerFilters.some(owner => ownerName.toLowerCase().includes(owner.toLowerCase()));
        });
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
    fm.addInput("搜索区域", "输入区域名称或ID", filter); // index 0

    // 维度筛选 - 使用多个开关
    fm.addLabel("维度筛选:"); // index 1
    fm.addSwitch("主世界(0)", dimFilters.includes(0)); // index 2
    fm.addSwitch("下界(-1)", dimFilters.includes(-1)); // index 3
    fm.addSwitch("末地(1)", dimFilters.includes(1)); // index 4

    // 区域主人搜索 - 允许多个
    fm.addInput("搜索区域主人", "输入主人名称，多个用逗号分隔", ownerFilters.join(", ")); // index 5

    // 区域列表
    const areaStartIndex = 6;
    for (let area of pageAreas) {
        // 获取区域主人名称
        const ownerName = playerMap[area.uuid] || area.playerName || "未知";

        // 获取维度名称
        let dimName;
        switch(area.dimid) {
            case 0: dimName = "主世界"; break;
            case -1: dimName = "下界"; break;
            case 1: dimName = "末地"; break;
            default: dimName = `维度${area.dimid}`;
        }

        // 计算区域大小
        const width = Math.abs(area.point2.x - area.point1.x) + 1;
        const height = Math.abs(area.point2.y - area.point1.y) + 1;
        const length = Math.abs(area.point2.z - area.point1.z) + 1;
        const size = width * height * length;

        // 显示格式：父区域名 / 区域名 (如果适用)
        let displayLabel = `§b${area.name || `区域...${area.id.substring(area.id.length - 4)}`}`;
        if (area.isSubarea && area.parentAreaId) {
             const parentArea = areaData[area.parentAreaId];
             if (parentArea) {
                 const parentName = parentArea.name || `区域...${area.parentAreaId.substring(area.parentAreaId.length - 4)}`;
                 displayLabel = `§b${parentName} / ${area.name || `区域...${area.id.substring(area.id.length - 4)}`}`;
             } else {
                 displayLabel = `§c[父未找到] / ${area.name || `区域...${area.id.substring(area.id.length - 4)}`}`;
             }
        }


        // 子区域数量信息 (直接从 areaData 查找)
        let subAreaCount = 0; // 重置计数器
        for (const subId in areaData) {
            if (areaData[subId].isSubarea && areaData[subId].parentAreaId === area.id) {
                subAreaCount++;
            }
        }
        // 重新计算当前区域的子区域数量
        for (const subId in areaData) {
            if (areaData[subId].isSubarea && areaData[subId].parentAreaId === area.id) {
                subAreaCount++;
            }
        }
        const subareaInfo = subAreaCount > 0 ? ` §7(含${subAreaCount}个子区域)` : "";


        fm.addSwitch(
            `${displayLabel} §r(ID: §7${area.id}§r)\n§7主人: §f${ownerName} §7| 维度: §f${dimName}\n§7大小: §f${width}×${height}×${length} §7(${size}方块)${subareaInfo}`,
            false
        );
    }
    const completeSwitchIndex = areaStartIndex + pageAreas.length;
    const pageSliderIndex = completeSwitchIndex + 1;
    const backSwitchIndex = pageSliderIndex + 1; // 新增返回开关的索引

    // 完成选择开关
    fm.addSwitch("完成选择", false); // index completeSwitchIndex

    // 分页选择器
    const pageItems = Array.from({length: totalPages}, (_, i) => `第${i + 1}页`);
    fm.addStepSlider("选择页码", pageItems, currentPage); // index pageSliderIndex

    // 返回按钮 (使用开关模拟，因为SimpleForm才有真按钮)
    fm.addSwitch("§c返回主菜单", false); // index backSwitchIndex

    // 发送表单
    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showMainForm(player); // 取消返回主菜单
            return;
        }

        // 检查是否点击了返回开关
        if (data[backSwitchIndex]) {
            showMainForm(player);
            return;
        }

        const keyword = data[0].trim();

        // 收集维度筛选
        const newDimFilters = [];
        if (data[2]) newDimFilters.push(0);  // 主世界
        if (data[3]) newDimFilters.push(-1); // 下界
        if (data[4]) newDimFilters.push(1);  // 末地

        // 处理多个区域主人筛选
        const ownerInput = data[5].trim();
        const newOwnerFilters = ownerInput ? ownerInput.split(",").map(o => o.trim()).filter(o => o) : [];

        const selectedAreas = [];

        // 收集选中的区域
        for (let i = 0; i < pageAreas.length; i++) {
            if (data[i + areaStartIndex] === true) {
                selectedAreas.push(pageAreas[i].id);
            }
        }

        const completeSwitch = data[completeSwitchIndex];
        const newPage = data[pageSliderIndex];

        // 处理表单结果
        if (completeSwitch && selectedAreas.length === 1) {
            // 来源是 'list'
            showAreaOperateForm(player, selectedAreas[0], 'list');
            return;
        }

        // 如果筛选条件改变，重新加载列表
        const dimFiltersChanged = JSON.stringify(dimFilters) !== JSON.stringify(newDimFilters);
        const ownerFiltersChanged = JSON.stringify(ownerFilters) !== JSON.stringify(newOwnerFilters);

        if (keyword !== filter || dimFiltersChanged || ownerFiltersChanged) {
            showAreaListForm(player, 0, keyword, newDimFilters, newOwnerFilters);
            return;
        }

        // 如果页码改变，重新加载列表
        if (newPage !== currentPage) {
            showAreaListForm(player, newPage, filter, dimFilters, ownerFilters);
            return;
        }

        if (selectedAreas.length !== 1) {
            player.tell("§e请选择一个区域并点击完成选择。");
            showAreaListForm(player, currentPage, filter, dimFilters, ownerFilters);
            return;
        }
    });
}

// 添加 origin 参数，默认为 'main'
function showAreaOperateForm(player, areaId, origin = 'main') {
    const { confirmResizeArea, showRenameForm, confirmDeleteArea, showTransferAreaForm, showAreaRulesForm } = require('./OperationForms');
    const { showPermissionManageForm, showGroupManageForm } = require('./permissionform');
    const { loadConfig } = require('./configManager'); // 引入 loadConfig
    const areaData = getAreaData();
    const area = areaData[areaId];
    if (!area) {
        player.tell("§c区域不存在！");
        // 根据来源决定返回哪里
        if (origin === 'list') {
            showAreaListForm(player);
        } else {
            showMainForm(player);
        }
        return;
    }

    const fm = mc.newSimpleForm();
    fm.setTitle(`§e[czland]§l${area.name} - §0操作菜单`);

    // 用于存储按钮和对应的处理函数
    const buttonHandlers = [];

    // 查看信息 - 总是可用
    fm.addButton("查看信息", "textures/items/book_writable"); // 更新书本图标
    // 传递 origin
    buttonHandlers.push(() => showAreaInfo(player, areaId, origin));

    // 检查 BSCI 是否可用，如果可用则添加按钮
    const { isBsciReady, showAreaWithChildrenVisualization } = require('./bsci'); // 确保 bsci.js 在这里引入
    if (isBsciReady()) {
        fm.addButton("显示区域轮廓", "textures/ui/world_glyph"); // 更新世界图标
        buttonHandlers.push(() => {
            // 调用已导入的函数
            showAreaWithChildrenVisualization(player, areaId);
            // 显示轮廓后，通常需要手动返回或再次打开菜单
             setTimeout(() => showAreaOperateForm(player, areaId, origin), 500); // 稍等片刻后重新显示菜单
        });
    }


    // 检查是否是区域所有者
    const isOwner = area.xuid === player.xuid;

    // 修改名称按钮 - 需要rename权限
    if(checkPermission(player, areaData, areaId, "rename")) {
        fm.addButton("修改名称", "textures/ui/anvil_icon"); // 路径正确
        // showRenameForm 内部会调用 showAreaOperateForm，需要传递 origin
        buttonHandlers.push(() => showRenameForm(player, areaId, origin));
    }

    // 管理权限按钮 - 需要setPlayerPermissions权限
    if(checkPermission(player, areaData, areaId, "setPlayerPermissions")) {
        fm.addButton("管理权限", "textures/ui/lock_color"); // 更新锁图标
        // 传递 origin
        buttonHandlers.push(() => showPermissionManageForm(player, areaId, origin));
    }

    // 删除区域按钮 - 需要 deleteArea 权限 (或者所有者)
    // 注意：原代码只检查了 isOwner，但最好用权限检查
    if(checkPermission(player, areaData, areaId, "deleteArea")) {
        fm.addButton("删除区域", "textures/ui/trash_default"); // 更新垃圾桶图标
        // confirmDeleteArea 内部会调用 showAreaOperateForm 或父区域的，需要传递 origin
        buttonHandlers.push(() => confirmDeleteArea(player, areaId, origin));
    }

    // 权限组管理按钮 - 需要manage权限 (通常所有者或管理员)
    if(checkPermission(player, areaData, areaId, "manage")) {
        fm.addButton("权限组管理", "textures/items/armor_stand"); // 更新盔甲架图标
        // 传递 origin
        buttonHandlers.push(() => showGroupManageForm(player, areaId, origin));
    }

    // 区域规则设置按钮 - 需要setAreaRules权限
    if(checkPermission(player, areaData, areaId, "setAreaRules")) {
        fm.addButton("区域规则设置", "textures/ui/recipe_book_icon"); // 更新配方书图标
        // showAreaRulesForm 内部会调用 showAreaOperateForm，需要传递 origin
        buttonHandlers.push(() => showAreaRulesForm(player, areaId, origin));
    }

    // 重新设置区域范围按钮 - 需要resizeArea权限
    if(checkPermission(player, areaData, areaId, "resizeArea")) {
        fm.addButton("重新设置区域范围", "textures/ui/equipped_item_border"); // 更新编辑图标
        // confirmResizeArea 内部会调用 showAreaOperateForm，需要传递 origin
        buttonHandlers.push(() => confirmResizeArea(player, areaId, origin));
    }

    // 转让区域按钮 - 仅所有者可见 (或者有 transferArea 权限)
    if(checkPermission(player, areaData, areaId, "transferArea")) { // 使用权限检查更佳
        fm.addButton("转让区域", "textures/ui/trade_icon"); // 路径正确
        // showTransferAreaForm 内部会调用 showAreaOperateForm，需要传递 origin
        buttonHandlers.push(() => showTransferAreaForm(player, areaId, origin));
    }

    // 子区域管理按钮 - 需要subareaManage权限
    if(checkPermission(player, areaData, areaId, "subareaManage")) {
        fm.addButton("子区域管理", "textures/ui/icon_recipe_nature"); // 更新树图标
        // showSubAreaManageForm 需要接收 origin 并传递下去
        buttonHandlers.push(() => showSubAreaManageForm(player, areaId, origin));
    }

    // --- 传送点功能 ---
    const config = loadConfig(); // 加载配置以检查传送功能是否启用
    if (config.teleport && config.teleport.enabled) {
        // 设置传送点按钮 - 需要 MANAGE 权限
        if (checkPermission(player, areaData, areaId, "MANAGE")) {
            fm.addButton("设置传送点", "textures/items/ender_pearl"); // 末影珍珠图标
            buttonHandlers.push(() => {
                if (setAreaTeleportPoint(player, areaId)) {
                    // 设置成功后可以重新显示表单，或者留在原地
                    // player.tell("§a传送点设置成功！"); // teleport.js 内部已有提示
                }
                // 无论成功与否，都重新显示操作菜单以便继续操作
                setTimeout(() => showAreaOperateForm(player, areaId, origin), 100); // 短暂延迟后显示
            });
        }

        // 传送到此区域按钮 - 需要 teleport 权限
        if (checkPermission(player, areaData, areaId, "teleport")) {
            fm.addButton("传送到此区域", "textures/items/chorus_fruit"); // 紫颂果图标
            buttonHandlers.push(() => {
                teleportPlayerToArea(player, areaId);
                // 传送后表单会自动关闭，不需要额外操作
            });
        }
    }
    // --- 传送点功能结束 ---


    // 添加返回按钮
    fm.addButton("§c返回", "textures/ui/cancel"); // 路径正确
    const backButtonIndex = buttonHandlers.length; // 返回按钮是最后一个

    player.sendForm(fm, (player, id) => {
        if (id === null) {
            // 取消时也根据 origin 返回
            if (origin === 'list') {
                showAreaListForm(player);
            } else {
                showMainForm(player);
            }
            return;
        }

        // 处理返回按钮
        if (id === backButtonIndex) {
            if (origin === 'list') {
                showAreaListForm(player);
            } else {
                showMainForm(player);
            }
            return;
        }

        // 执行对应按钮的处理函数
        if (id >= 0 && id < buttonHandlers.length) {
            buttonHandlers[id]();
        }
    });
}




// 添加 origin 参数
function showAreaInfo(player, areaId, origin) {
    const areaData = getAreaData();
    const area = areaData[areaId];
    if (!area) {
        player.tell("§c无法获取区域信息！");
        // 根据 origin 返回
        showAreaOperateForm(player, areaId, origin);
        return;
    }

    // 获取所有玩家数据用于显示名称
    const allPlayers = getOfflinePlayerData() || [];
    const playerXuidMap = {}; // 创建一个专门用于 XUID 查找的映射
    const playerUuidMap = {}; // 也创建一个 UUID 映射，以备他用
    allPlayers.forEach(p => {
        if (p.xuid) {
            playerXuidMap[p.xuid] = p.name;
        }
        if (p.uuid) {
            playerUuidMap[p.uuid] = p.name; // 如果其他地方需要 UUID 查找
        }
    });


    // 获取所有自定义组用于显示名称
    const availableGroups = getAvailableGroups();

    // 获取区域的特定玩家权限 (需要一个函数来获取, 这里假设 area.permissions 存在或通过 getPlayerPermission 获取)
    // 注意：直接访问 area.permissions 可能不是最佳实践，理想情况下应有专用函数
    // 获取区域的特定玩家权限 - 直接查询数据库
    const { getDbSession } = require('./database'); // 引入数据库会话
    const areaPermissions = {}; // { uuid: groupName }
    try {
        const db = getDbSession();
        const stmt = db.prepare("SELECT playerUuid, groupName FROM permissions WHERE areaId = ?");
        stmt.bind(areaId);
        while (stmt.step()) {
            const row = stmt.fetch();
            if (row && row.playerUuid && row.groupName) { // 确保数据有效
                areaPermissions[row.playerUuid] = row.groupName;
            }
        }
        // stmt.reset(); // 根据 LLSE API 决定是否需要 reset
        logDebug(`为区域 ${areaId} 查询到 ${Object.keys(areaPermissions).length} 条特定权限记录`);
    } catch (e) {
        logError(`在 showAreaInfo 中查询区域 ${areaId} 权限失败: ${e}`, e.stack);
        // 即使查询失败，也继续显示其他信息
    }


    // 获取区域主人名称
    const ownerName = playerXuidMap[area.xuid] || "未知"; // 使用 XUID 映射查找

    // 获取维度名称
    let dimName;
    switch(area.dimid) {
        case 0: dimName = "主世界"; break;
        case -1: dimName = "下界"; break;
        case 1: dimName = "末地"; break;
        default: dimName = `维度${area.dimid}`;
    }

    // 计算区域大小
    const width = Math.abs(area.point2.x - area.point1.x) + 1;
    const height = Math.abs(area.point2.y - area.point1.y) + 1;
    const length = Math.abs(area.point2.z - area.point1.z) + 1;
    const size = width * height * length;

    // 构建信息字符串
    let infoContent = `§l区域名称: §r${area.name}\n`;
    infoContent += `§l区域ID: §r${areaId}\n`;
    infoContent += `§l主人: §r${ownerName} \n`;
    infoContent += `§l创建时间: §r${new Date(area.createTime).toLocaleString()}\n`;
    infoContent += `§l维度: §r${dimName}\n`;
    infoContent += `§l坐标: §r(${area.point1.x}, ${area.point1.y}, ${area.point1.z}) - (${area.point2.x}, ${area.point2.y}, ${area.point2.z})\n`;
    infoContent += `§l大小: §r${width}×${height}×${length} (${size}方块)\n`;
    infoContent += `§l优先级: §r${area.priority || 0}\n`; // 显示优先级

    // 不再显示完整层级路径，只显示直接父区域（如果存在）
    // const hierarchyPath = getAreaHierarchyPath(areaId, areaData, 3); // 获取最多3级
    // infoContent += `§l层级路径: §r${hierarchyPath}\n`;

    // 如果是子区域，明确显示直接父区域信息
    if (area.isSubarea && area.parentAreaId) {
        const parentArea = areaData[area.parentAreaId];
        if (parentArea) {
            const parentOwnerName = playerXuidMap[parentArea.xuid] || "未知";
            infoContent += `§l直接父区域: §r${parentArea.name || `区域...${area.parentAreaId.substring(area.parentAreaId.length - 4)}`} §7(ID: ${area.parentAreaId}, 主人: ${parentOwnerName})\n`;
        } else {
            infoContent += `§l直接父区域: §c未找到 (ID: ${area.parentAreaId})\n`;
        }
    }

    // --- 权限信息 ---
    infoContent += "\n§l--- 权限信息 ---§r\n";

    // 1. 检查是否为区域主人
    let permissionSource = "未知";
    let effectiveGroupName = null; // 用于后续查找权限列表
    let isOwner = false;
    let isParentOwner = false;

    if (area.xuid === player.xuid) {
        permissionSource = "§a区域主人 (拥有所有权限)";
        isOwner = true;
    } else if (area.isSubarea && area.parentAreaId) {
        const parentArea = areaData[area.parentAreaId];
        if (parentArea && parentArea.xuid === player.xuid) {
            permissionSource = "§a父区域主人 (继承所有权限)";
            isParentOwner = true;
        }
    }

    // 2. 如果不是主人，则检查权限继承链
    if (!isOwner && !isParentOwner) {
        const playerSpecificGroup = getPlayerPermission(player.uuid, areaId);
        const areaDefaultGroup = getAreaDefaultGroup(areaId);

        if (playerSpecificGroup) {
            permissionSource = `特定设置: §b${availableGroups[playerSpecificGroup]?.name || playerSpecificGroup}`;
            effectiveGroupName = playerSpecificGroup;
        } else if (area.isSubarea && area.parentAreaId) {
            const playerParentSpecificGroup = getPlayerPermission(player.uuid, area.parentAreaId);
            const parentAreaDefaultGroup = getAreaDefaultGroup(area.parentAreaId);

            if (playerParentSpecificGroup) {
                permissionSource = `继承自父区域特定设置: §b${availableGroups[playerParentSpecificGroup]?.name || playerParentSpecificGroup}`;
                effectiveGroupName = playerParentSpecificGroup;
            } else if (areaDefaultGroup) { // 子区域自己的默认组优先于父区域的默认组
                permissionSource = `区域默认: §b${availableGroups[areaDefaultGroup]?.name || areaDefaultGroup}`;
                effectiveGroupName = areaDefaultGroup;
            } else if (parentAreaDefaultGroup) {
                permissionSource = `继承自父区域默认: §b${availableGroups[parentAreaDefaultGroup]?.name || parentAreaDefaultGroup}`;
                effectiveGroupName = parentAreaDefaultGroup;
            } else {
                permissionSource = "系统默认";
                // effectiveGroupName remains null
            }
        } else if (areaDefaultGroup) {
            permissionSource = `区域默认: §b${availableGroups[areaDefaultGroup]?.name || areaDefaultGroup}`;
            effectiveGroupName = areaDefaultGroup;
        } else {
            permissionSource = "系统默认";
            // effectiveGroupName remains null
        }
    }

    infoContent += `§e你的权限来源: §r${permissionSource}\n`;

    // 显示当前玩家的有效权限列表 (如果不是主人)
    let effectivePermissions = [];
    if (!isOwner && !isParentOwner) {
        if (effectiveGroupName) {
            // 尝试从缓存或数据库获取组的权限列表
            // 需要 getCustomGroupCached 或类似函数，这里模拟直接查询
            try {
                const db = getDbSession();
                // 先查是哪个uuid创建的这个组
                const stmtUuid = db.prepare("SELECT uuid FROM custom_groups WHERE groupName = ? LIMIT 1");
                stmtUuid.bind(effectiveGroupName);
                let groupOwnerUuid = null;
                if (stmtUuid.step()) {
                    groupOwnerUuid = stmtUuid.fetch().uuid;
                }

                if (groupOwnerUuid) {
                    const stmtPerms = db.prepare("SELECT permissions FROM custom_groups WHERE uuid = ? AND groupName = ?");
                    stmtPerms.bind([groupOwnerUuid, effectiveGroupName]);
                    if (stmtPerms.step()) {
                        const row = stmtPerms.fetch();
                        if (row && typeof row.permissions === 'string') {
                            try {
                                effectivePermissions = JSON.parse(row.permissions);
                                if (!Array.isArray(effectivePermissions)) effectivePermissions = [];
                            } catch (parseError) {
                                logWarning(`解析权限组 ${effectiveGroupName} 的权限时出错: ${parseError}`);
                                effectivePermissions = ['§c解析错误§r'];
                            }
                        }
                    }
                } else {
                     logWarning(`无法找到权限组 ${effectiveGroupName} 的创建者UUID`);
                     effectivePermissions = ['§c组未找到§r'];
                }
            } catch(dbError) {
                logError(`查询权限组 ${effectiveGroupName} 权限时出错: ${dbError}`);
                effectivePermissions = ['§c查询错误§r'];
            }
        } else {
            // 使用系统默认权限
            const { getSystemDefaultPermissions } = require('./permission'); // 确保引入
            effectivePermissions = getSystemDefaultPermissions();
        }
        infoContent += `§e你的有效权限: §r${effectivePermissions.length > 0 ? effectivePermissions.join(', ') : '无'}\n`;
    }


    // 显示特定权限成员 (拥有特定权限的)
    infoContent += "§l特定权限成员:\n";
    let specificMemberCount = 0;
    for (const uuid in areaPermissions) {
        const groupName = areaPermissions[uuid];
        // 注意：这里 areaPermissions 的键是 uuid，所以我们用 playerUuidMap
        const playerName = playerUuidMap[uuid] || "未知玩家";
        const groupDisplayName = availableGroups[groupName]?.name || groupName;
        if (groupName) { // 确保 groupName 存在
            infoContent += `  §f${playerName}: §b${groupDisplayName}\n`;
            specificMemberCount++;
        }
    }
    if (specificMemberCount === 0) {
        infoContent += "  §7无\n";
    }

    // 显示直接子区域列表
    infoContent += "\n§l--- 直接子区域列表 ---§r\n";
    let directSubAreaCount = 0;
    for (const subId in areaData) {
        const subArea = areaData[subId];
        if (subArea.isSubarea && subArea.parentAreaId === areaId) {
            const subOwnerName = playerXuidMap[subArea.xuid] || "未知";
            // 显示子区域自己的名字，而不是完整路径
            infoContent += `  §f${subArea.name || `区域...${subId.substring(subId.length - 4)}`} §7(ID: ${subId}, 主人: ${subOwnerName})\n`;
            directSubAreaCount++;
        }
    }
     if (directSubAreaCount === 0) {
        infoContent += "  §7无直接子区域\n";
    }


    const fm = mc.newSimpleForm();
    fm.setTitle(`${area.name} - 详细信息`);
    fm.setContent(infoContent); // 使用 setContent 显示所有信息
    fm.addButton("§c返回", "textures/ui/cancel"); // 路径正确

    player.sendForm(fm, (player, id) => {
        // 只有一个按钮，点击即返回操作菜单，并传递 origin
        showAreaOperateForm(player, areaId, origin);
    });
}








// 导出函数
module.exports = {
    showMainForm,
    showAreaOperateForm,
    // 也导出其他可能被外部调用的表单函数（如果需要）
    showAreaListForm,
    handleCurrentArea,
    showAreaInfo,
};
