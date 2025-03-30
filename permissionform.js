const { loadAreaData, saveAreaData } = require('./config');
const { getAreaData, updateAreaData } = require('./czareaprotection'); // Added updateAreaData
const { isInArea, isAreaWithinArea, checkNewAreaOverlap, checkAreaSizeLimits } = require('./utils'); // Added utils functions
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
const { getPlayerCustomGroups, createCustomGroup, editCustomGroup, deleteCustomGroup, getAllCustomGroups } = require('./customGroups'); // Ensure getAllCustomGroups is imported if needed elsewhere, though getAvailableGroups uses it internally
const { checkPermission, setPlayerPermission, getPlayerPermission, getAvailableGroups, getAreaDefaultGroup, setAreaDefaultGroup, resetCache, groupHasAdminPermissions } = require('./permission'); // Removed DEFAULT_GROUPS import, Added resetCache, Added groupHasAdminPermissions explicitly
const { getPlayerData } = require('./playerDataManager');
const { calculateAreaPrice, handleAreaPurchase, handleAreaRefund, getPlayerBalance, reducePlayerBalance, addPlayerBalance } = require('./economy'); // Added economy functions
// LiteLoader-AIDS automatic generated
/// <reference path="d:\mc\插件/dts/HelperLib-master/src/index.d.ts"/>
const { loadConfig } = require('./configManager');
const { showSubAreaManageForm } = require('./subareaForms');
const {logDebug, logInfo, logWarning, logError } = require('./logger');

// --- 主权限管理表单 ---
function showPermissionManageForm(player, areaId, origin) {
    const { showAreaOperateForm} = require('./mainForm');
    const areaData = getAreaData();
    const area = areaData[areaId];
    if(!checkPermission(player, areaData, areaId, "setPlayerPermissions")) {
        player.tell("§c你没有权限管理区域成员！");
        showAreaOperateForm(player, areaId, origin);
        return;
    }

    const fm = mc.newSimpleForm();
    fm.setTitle(`§e[czland]§l${area.name} - §0权限管理`);
    fm.addButton("设置玩家权限组", "textures/ui/Add-Ons_Nav_Icon36x36"); // 设置权限
    fm.addButton("移除成员权限", "textures/ui/red_x"); // 移除权限按钮，更改图标
    fm.addButton("设置默认权限组", "textures/ui/settings_glyph_color_2x");
    fm.addButton("§c返回", "textures/ui/cancel");


    player.sendForm(fm, (player, id) => {
        if (id === null) {
             showAreaOperateForm(player, areaId, origin);
             return;
        }

        switch (id) {
            case 0:
                showSetPlayerGroupForm(player, areaId, origin); // 设置权限
                break;
            case 1:
                showRemoveMemberPermissionForm(player, areaId, origin); // 调用移除权限表单
                break;
            case 2:
                showAreaDefaultGroupForm(player, areaId, origin);
                break;
            case 3:
                showAreaOperateForm(player, areaId, origin);
                break;
        }
    });
}

// --- 设置玩家权限组表单 ---
function showSetPlayerGroupForm(player, areaId, origin, currentPage = 0, filter = "") {
    const areaData = getAreaData();
    const area = areaData[areaId];
    const hasAdminRight = checkPermission(player, areaData, areaId, "grantAdminPermissions");
    const allPlayers = getOfflinePlayerData() || [];

    let filteredPlayers = allPlayers;
    if (filter.trim() !== "") {
        filteredPlayers = allPlayers.filter(p =>
            p.name.toLowerCase().includes(filter.toLowerCase()));
    }

    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
    currentPage = Math.min(currentPage, totalPages - 1);

    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredPlayers.length);
    const pagePlayers = filteredPlayers.slice(startIndex, endIndex);

    const fm = mc.newCustomForm();
    fm.setTitle(`${area.name} - 设置玩家权限组 (第 ${currentPage + 1}/${totalPages} 页)`);
    fm.addInput("搜索玩家", "输入玩家名称", filter); // index 0

    const playerStartIndex = 1;
    for (let p of pagePlayers) {
        fm.addSwitch(`${p.name}`, false);
    }
    const groupDropdownIndex = playerStartIndex + pagePlayers.length;
    const confirmSwitchIndex = groupDropdownIndex + 1;
    const pageSliderIndex = confirmSwitchIndex + 1;
    const backSwitchIndex = pageSliderIndex + 1;

    const { getPlayerCustomGroups } = require('./customGroups');
    const groups = getPlayerCustomGroups(player.uuid);
    const filteredGroupIds = Object.keys(groups)
        .filter(g => hasAdminRight || !groupHasAdminPermissions(g, groups));
    const groupNames = filteredGroupIds.map(g => `${groups[g].name} (${g})`);
    fm.addDropdown("选择权限组", groupNames.length > 0 ? groupNames : ["无可用权限组"], 0); // index groupDropdownIndex

    fm.addSwitch("确认设置", false); // index confirmSwitchIndex
    const pageItems = Array.from({length: totalPages}, (_, i) => `第${i + 1}页`);
    fm.addStepSlider("选择页码", pageItems, currentPage); // index pageSliderIndex
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }
        if (data[backSwitchIndex]) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }

        const keyword = data[0].trim();
        const selectedGroupIndex = data[groupDropdownIndex];
        const confirmed = data[confirmSwitchIndex];
        const newPage = data[pageSliderIndex];

        if (newPage !== currentPage || keyword !== filter) {
            showSetPlayerGroupForm(player, areaId, origin, newPage, keyword);
            return;
        }

        if (confirmed) {
            if (filteredGroupIds.length === 0) {
                player.tell("§c没有可用的权限组可以选择！");
                showSetPlayerGroupForm(player, areaId, origin, currentPage, filter);
                return;
            }
            const selectedGroup = filteredGroupIds[selectedGroupIndex];
            if (!selectedGroup) {
                 player.tell("§c请选择一个有效的权限组！");
                 showSetPlayerGroupForm(player, areaId, origin, currentPage, filter);
                 return;
            }

            let added = 0;
            let selectedPlayerCount = 0;
            for (let i = 0; i < pagePlayers.length; i++) {
                if (data[i + playerStartIndex]) {
                    selectedPlayerCount++;
                    const targetUuid = pagePlayers[i].uuid;
                    if (!hasAdminRight && groupHasAdminPermissions(selectedGroup, groups)) {
                        player.tell(`§c你没有权限设置管理类权限组 (${selectedGroup}) 给玩家 ${pagePlayers[i].name}!`);
                        continue;
                    }
                    if (setPlayerPermission(targetUuid, areaId, selectedGroup)) {
                        added++;
                        logDebug(`成功为玩家 ${pagePlayers[i].name} (${targetUuid}) 设置权限组 ${selectedGroup}`);
                    } else {
                         player.tell(`§c为玩家 ${pagePlayers[i].name} 设置权限组 ${selectedGroup} 失败。`);
                         logWarning(`为玩家 ${pagePlayers[i].name} (${targetUuid}) 设置权限组 ${selectedGroup} 失败`);
                    }
                }
            }

            if (added > 0) {
                player.tell(`§a成功为 ${added} 个玩家设置权限组: ${groups[selectedGroup].name}`);
            } else if (selectedPlayerCount > 0) {
                 player.tell(`§c未能成功为任何选定玩家设置权限组。`);
            } else {
                 player.tell("§e请至少选择一个玩家。");
                 showSetPlayerGroupForm(player, areaId, origin, currentPage, filter);
                 return;
            }
            showPermissionManageForm(player, areaId, origin);
            return;
        }
        player.tell("§e请选择玩家，选择权限组，并打开“确认设置”开关。");
        showSetPlayerGroupForm(player, areaId, origin, currentPage, filter);
    });
}

// --- 移除成员特定权限表单 ---
function showRemoveMemberPermissionForm(player, areaId, origin, currentPage = 0) {
    const areaData = getAreaData();
    const area = areaData[areaId];

    // 检查是否有移除权限的权限 (复用 setPlayerPermissions)
    if(!checkPermission(player, areaData, areaId, "setPlayerPermissions")) {
        player.tell("§c你没有权限移除区域成员的权限！");
        showPermissionManageForm(player, areaId, origin);
        return;
    }

    // 获取所有在该区域有特定权限设置的玩家
    const { getDbSession } = require('./database');
    const permissions = {}; // { uuid: groupName }
    try {
        const db = getDbSession();
        const stmt = db.prepare("SELECT playerUuid, groupName FROM permissions WHERE areaId = ?");
        stmt.bind(areaId);
        while (stmt.step()) {
            const row = stmt.fetch();
            if (row && row.playerUuid && row.groupName) {
                permissions[row.playerUuid] = row.groupName;
            }
        }
        logDebug(`为区域 ${areaId} 的移除权限列表查询到 ${Object.keys(permissions).length} 条特定权限记录`);
    } catch (e) {
        logError(`在 showRemoveMemberPermissionForm 中查询区域 ${areaId} 权限失败: ${e}`, e.stack);
        player.tell("§c查询成员列表时出错！");
        showPermissionManageForm(player, areaId, origin);
        return;
    }

    const memberUuidsWithPerms = Object.keys(permissions);

    // 分页设置
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(memberUuidsWithPerms.length / pageSize));
    currentPage = Math.min(currentPage, totalPages - 1);

    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, memberUuidsWithPerms.length);
    const pageMemberUuids = memberUuidsWithPerms.slice(startIndex, endIndex);

    const fm = mc.newCustomForm();
    fm.setTitle(`${area.name} - 移除成员权限 (第 ${currentPage + 1}/${totalPages} 页)`);

    // 获取玩家名称和组名称的映射
    const allPlayers = getOfflinePlayerData() || [];
    const playerMap = {};
    allPlayers.forEach(p => playerMap[p.uuid] = p.name);
    const availableGroups = getAvailableGroups();

    // 存储当前页成员的 UUID 和对应的开关索引
    const pageMemberData = []; // [{ uuid: string, switchIndex: number }]

    // 显示当前页的有权限的成员 - 使用开关
    let currentControlIndex = 0;
    if (pageMemberUuids.length === 0) {
        fm.addLabel("§7该区域尚无特定权限成员可移除。");
        currentControlIndex++;
    } else {
        for (let i = 0; i < pageMemberUuids.length; i++) {
            const uuid = pageMemberUuids[i];
            const groupName = permissions[uuid];
            const playerName = playerMap[uuid] || `未知UUID(${uuid.substring(0, 8)}...)`;
            const groupDisplayName = availableGroups[groupName]?.name || groupName;

            // 添加开关，标签为玩家信息
            fm.addSwitch(`${playerName} - ${groupDisplayName} (${groupName})`, false);
            const switchIndex = currentControlIndex++;
            pageMemberData.push({ uuid: uuid, switchIndex: switchIndex });
        }
    }

    // 计算后续控件索引
    const confirmSwitchIndex = currentControlIndex++;
    const pageSliderIndex = currentControlIndex++;
    const backSwitchIndex = currentControlIndex++;

    // 确认移除开关
    fm.addSwitch("§c确认移除所选成员的特定权限", false); // index confirmSwitchIndex

    // 分页选择器
    const pageItems = Array.from({ length: totalPages }, (_, i) => `第${i + 1}页`);
    fm.addStepSlider("选择页码", pageItems, currentPage); // index pageSliderIndex

    // 返回按钮
    fm.addSwitch("§c返回", false); // index backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if (data === null) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }

        // 检查返回开关
        if (data[backSwitchIndex]) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }

        const confirmed = data[confirmSwitchIndex];
        const newPage = data[pageSliderIndex];

        // 处理页面切换
        if (newPage !== currentPage) {
            showRemoveMemberPermissionForm(player, areaId, origin, newPage);
            return;
        }

        // 处理移除权限
        if (confirmed) {
            let removedCount = 0;
            let selectedPlayerCount = 0;

            for (const member of pageMemberData) {
                if (data[member.switchIndex] === true) { // 如果该玩家被选中
                    selectedPlayerCount++;
                    const targetUuid = member.uuid;
                    const targetName = playerMap[targetUuid] || `未知UUID(${targetUuid.substring(0, 8)}...)`;

                    // 移除特定权限设置 (设置为 null)
                    if (setPlayerPermission(targetUuid, areaId, null)) {
                        removedCount++;
                        logDebug(`成功移除玩家 ${targetName} (${targetUuid}) 的特定权限`);
                    } else {
                        player.tell(`§c移除玩家 ${targetName} 的特定权限失败。`);
                        logWarning(`移除玩家 ${targetName} (${targetUuid}) 的特定权限失败`);
                    }
                }
            }

            if (removedCount > 0) {
                player.tell(`§a成功移除了 ${removedCount} 个成员的特定权限设置。`);
            } else if (selectedPlayerCount > 0) {
                player.tell(`§c未能成功移除任何选定成员的特定权限。`);
            } else {
                player.tell("§e请至少选择一个要移除权限的成员。");
                showRemoveMemberPermissionForm(player, areaId, origin, currentPage);
                return;
            }

            // 操作完成后返回主菜单
            showPermissionManageForm(player, areaId, origin);
            return;
        }

        // 如果没有确认
        player.tell("§e请选择要移除权限的成员，并打开“确认移除”开关。");
        showRemoveMemberPermissionForm(player, areaId, origin, currentPage);
    });
}


// --- 设置区域默认权限组表单 ---
function showAreaDefaultGroupForm(player, areaId, origin) {
    const areaData = getAreaData();
    const area = areaData[areaId];

    if(!checkPermission(player, areaData, areaId, "setAreaDefaultGroup")) {
        player.tell("§c你没有权限修改默认权限组！");
        showPermissionManageForm(player, areaId, origin);
        return;
    }
    const hasAdminRight = checkPermission(player, areaData, areaId, "grantAdminPermissions");

    const fm = mc.newCustomForm();
    fm.setTitle("设置区域默认权限组");

    const availableGroups = getAvailableGroups();
    const playerGroups = getPlayerCustomGroups(player.uuid);
    const filteredGroupIds = Object.keys(playerGroups)
        .filter(g => hasAdminRight || !groupHasAdminPermissions(g, playerGroups));
    const groupNames = filteredGroupIds.map(g => `${playerGroups[g].name} (${g})`);
    groupNames.unshift("使用系统默认权限"); // Index 0

    const currentDefault = getAreaDefaultGroup(areaId);
    let currentIndex = 0;
    let conditionalLabelAdded = false;

    if (currentDefault) {
        const idx = filteredGroupIds.indexOf(currentDefault);
        if (idx !== -1) {
            currentIndex = idx + 1;
        } else {
             logWarning(`区域 ${areaId} 的当前默认组 ${currentDefault} 不在玩家 ${player.name} 的可选列表中。`);
             const currentDefaultName = availableGroups[currentDefault]?.name || currentDefault;
             fm.addLabel(`§e当前默认组: ${currentDefaultName} (你无权选择此组)`);
             conditionalLabelAdded = true;
        }
    }

    let elementIndex = 0;
    let dropdownIndex = -1;
    let backSwitchIndex = -1;

    if (conditionalLabelAdded) {
        elementIndex++; // 标签占位
    }
    fm.addLabel("§e选择一个权限组作为该区域的默认权限组\n§7未设置特定权限组的玩家将使用此权限组");
    elementIndex++; // 说明标签占位
    fm.addDropdown("选择默认权限组", groupNames.length > 0 ? groupNames : ["使用系统默认权限"], currentIndex);
    dropdownIndex = elementIndex++;
    fm.addSwitch("§c返回", false);
    backSwitchIndex = elementIndex++;

    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }
        if (data[backSwitchIndex]) {
            showPermissionManageForm(player, areaId, origin);
            return;
        }

        const selectedIndex = data[dropdownIndex];
        let selectedGroupName = null;
        if (selectedIndex === 0) {
            selectedGroupName = null;
             logDebug(`玩家 ${player.name} 选择为区域 ${areaId} 设置系统默认权限`);
        } else {
            if (filteredGroupIds.length === 0 || selectedIndex > filteredGroupIds.length) {
                 player.tell("§c无效的选择！");
                 showAreaDefaultGroupForm(player, areaId, origin);
                 return;
            }
            selectedGroupName = filteredGroupIds[selectedIndex - 1];
            logDebug(`玩家 ${player.name} 选择为区域 ${areaId} 设置默认权限组: ${selectedGroupName}`);
            if (!hasAdminRight && groupHasAdminPermissions(selectedGroupName, playerGroups)) {
                player.tell(`§c你没有权限设置包含管理权限的默认权限组 (${selectedGroupName})!`);
                showPermissionManageForm(player, areaId, origin);
                return;
            }
        }
        const success = setAreaDefaultGroup(areaId, selectedGroupName);
        if(success) {
            const message = selectedGroupName
                ? `§a已将区域默认权限组设置为: ${playerGroups[selectedGroupName]?.name || selectedGroupName}`
                : `§a已设置区域使用系统默认权限`;
            player.tell(message);
        } else {
            player.tell("§c设置默认权限组失败！");
        }
        showPermissionManageForm(player, areaId, origin);
    });
}

// --- 权限组管理相关表单 (创建、列表、编辑) ---

function showGroupManageForm(player, areaId, origin) {
    const { showAreaOperateForm} = require('./mainForm');
    const fm = mc.newSimpleForm();
    fm.setTitle("权限组管理");
    fm.addButton("创建新权限组", "textures/ui/pick_block");
    fm.addButton("管理现有权限组", "textures/ui/permissions_op_crown");
    fm.addButton("§c返回", "textures/ui/cancel");

    player.sendForm(fm, (player, id) => {
        if(id === null) {
            showAreaOperateForm(player, areaId, origin);
            return;
        }
        switch(id) {
            case 0: showCreateGroupForm(player, areaId, origin); break;
            case 1: showGroupListForm(player, areaId, origin); break;
            case 2: showAreaOperateForm(player, areaId, origin); break;
        }
    });
}

function showCreateGroupForm(player, areaId, origin) {
    const { getPermissionsByCategory, getAllCategories } = require('./permissionRegistry');
    const fm = mc.newCustomForm();
    fm.setTitle("创建权限组");
    fm.addInput("权限组ID", "例如: vip"); // 0
    fm.addInput("显示名称", "例如: VIP会员"); // 1
    fm.addLabel("§7注意：直接选择所有需要的权限"); // 2

    let permissionFormIndexes = new Map();
    let currentIndex = 3;
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
    const backSwitchIndex = currentIndex;
    fm.addSwitch("§c返回", false); // backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showGroupManageForm(player, areaId, origin);
            return;
        }
        if (data[backSwitchIndex]) {
            showGroupManageForm(player, areaId, origin);
            return;
        }

        const groupId = data[0].trim();
        const displayName = data[1].trim();
        if(!groupId || !displayName) {
            player.tell("§c权限组ID和显示名称不能为空！");
            showCreateGroupForm(player, areaId, origin);
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(groupId)) {
             player.tell("§c权限组ID只能包含字母、数字和下划线！");
             showCreateGroupForm(player, areaId, origin);
             return;
        }

        const permissions = [];
        permissionFormIndexes.forEach((permId, index) => {
            if(data[index] === true) {
                permissions.push(permId);
            }
        });
        logDebug(`创建权限组: ${groupId}, 权限: ${JSON.stringify(permissions)}`);

        if(createCustomGroup(player.uuid, groupId, displayName, permissions, null)) {
            player.tell(`§a权限组创建成功！\n§7包含权限: ${permissions.join(', ')}`);
            showGroupManageForm(player, areaId, origin);
        } else {
            player.tell("§c权限组创建失败！(可能ID已存在)");
            showCreateGroupForm(player, areaId, origin);
        }
    });
}

function showGroupListForm(player, areaId, origin) {
    const groups = getPlayerCustomGroups(player.uuid);
    const fm = mc.newSimpleForm();
    fm.setTitle("我的权限组");
    const groupIds = Object.keys(groups);

    if (groupIds.length === 0) {
        fm.setContent("§7你还没有创建任何权限组。");
    } else {
        groupIds.forEach(groupId => {
            const group = groups[groupId];
            const permCount = group.permissions?.length || 0;
            fm.addButton(`${group.name} (${groupId})\n§7权限数: ${permCount}`, "textures/ui/icon_recipe_item");
        });
    }
    fm.addButton("§c返回", "textures/ui/cancel");
    const backButtonIndex = groupIds.length;

    player.sendForm(fm, (player, id) => {
        if(id === null) {
            showGroupManageForm(player, areaId, origin);
            return;
        }
        if (id === backButtonIndex) {
            showGroupManageForm(player, areaId, origin);
            return;
        }
        if (id >= 0 && id < groupIds.length) {
            showGroupEditForm(player, groupIds[id], areaId, origin);
        }
    });
}

function showGroupEditForm(player, groupId, areaId, origin) {
    const { getPermissionsByCategory, getAllCategories } = require('./permissionRegistry');
    const groups = getPlayerCustomGroups(player.uuid);
    const group = groups[groupId];

    if (!group) {
        player.tell(`§c找不到权限组 ${groupId} 或你没有权限编辑它。`);
        showGroupListForm(player, areaId, origin);
        return;
    }

    const fm = mc.newCustomForm();
    fm.setTitle(`编辑权限组 - ${group.name}`);
    fm.addInput("显示名称", "权限组显示名称", group.name); // 0
    fm.addLabel("§7注意：直接选择所有需要的权限"); // 1

    let permissionFormIndexes = new Map();
    let currentIndex = 2;
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
    const deleteSwitchIndex = currentIndex++;
    const backSwitchIndex = currentIndex++;
    fm.addSwitch("§c删除此权限组", false); // deleteSwitchIndex
    fm.addSwitch("§c返回", false); // backSwitchIndex

    player.sendForm(fm, (player, data) => {
        if(data === null) {
            showGroupListForm(player, areaId, origin);
            return;
        }
        if (data[backSwitchIndex]) {
            showGroupListForm(player, areaId, origin);
            return;
        }

        if(data[deleteSwitchIndex]) {
            const confirmFm = mc.newModalForm();
            confirmFm.setTitle("确认删除权限组");
            confirmFm.setContent(`§c确定要删除权限组 "${group.name}" (${groupId}) 吗？\n此操作不可撤销！`);
            confirmFm.setButton1("§c确认删除");
            confirmFm.setButton2("取消");
            player.sendForm(confirmFm, (player, confirmed) => {
                if (confirmed) {
                    if(deleteCustomGroup(player.uuid, groupId)) {
                        player.tell("§a权限组已删除！");
                        resetCache();
                        logInfo(`权限组 ${groupId} 已被玩家 ${player.name} 删除，权限缓存已重置`);
                    } else {
                        player.tell("§c删除权限组失败！");
                    }
                    showGroupListForm(player, areaId, origin);
                } else {
                    showGroupEditForm(player, groupId, areaId, origin);
                }
            });
            return;
        }

        const newName = data[0].trim();
        if(!newName) {
            player.tell("§c显示名称不能为空！");
            showGroupEditForm(player, groupId, areaId, origin);
            return;
        }

        const permissions = [];
        permissionFormIndexes.forEach((permId, index) => {
            if(data[index] === true) {
                permissions.push(permId);
            }
        });
        logDebug(`编辑权限组: ${groupId}, 新权限: ${JSON.stringify(permissions)}`);

        if(editCustomGroup(player.uuid, groupId, newName, permissions, null)) {
            player.tell(`§a权限组修改成功！\n§7包含权限: ${permissions.join(', ')}`);
            resetCache();
            logInfo(`权限组 ${groupId} 修改后，权限缓存已重置`);
            showGroupListForm(player, areaId, origin);
        } else {
            player.tell("§c权限组修改失败！");
            showGroupEditForm(player, groupId, areaId, origin);
        }
    });
}

// --- 导出函数 ---
module.exports = {
    showPermissionManageForm,
    showGroupManageForm,
    showAreaDefaultGroupForm,
    // showMemberListForm, // 移除旧的列表函数
    // showMemberEditForm, // 移除编辑函数入口
    showSetPlayerGroupForm,
    showRemoveMemberPermissionForm, // 导出新的移除函数
    showGroupListForm,
    showGroupEditForm,
    showCreateGroupForm
};
